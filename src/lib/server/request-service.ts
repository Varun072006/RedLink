import "server-only";
import { createHash } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { bloodRequestSchema } from "@/lib/domain/schemas";
import { computeExpiry, initialRadiusKm, isTerminal, STATUS_LABELS, type RequestStatus } from "@/lib/domain/request-state";
import { generateReference, generateTrackingToken, hashTrackingToken, isPlausibleToken } from "@/lib/domain/tracking";
import { roundCoordinate } from "@/lib/domain/distance";
import { fail, zodFail, type ActionResult } from "@/lib/action-result";
import { allow, allowByClient } from "./rate-limit";
import { maintainRequest, runMatching } from "./matching-service";

export async function createBloodRequest(
  raw: unknown,
  submissionId: string,
  requesterId: string | null,
): Promise<ActionResult<{ token: string; reference: string }>> {
  const parsed = bloodRequestSchema.safeParse(raw);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) return fail("Invalid submission. Please reload and try again.");

  if (!(await allowByClient("request", 5, 3600))) {
    return fail("Too many requests from this device. Please wait before trying again, or call the hospital directly.");
  }
  const phoneKey = createHash("sha256").update(input.contactPhone.replace(/\D/g, "")).digest("hex").slice(0, 24);
  if (!(await allow(`request-phone:${phoneKey}`, 6, 86400))) {
    return fail("Too many requests for this phone number today. Please contact the treating facility directly.");
  }
  if (!(await allow(`idem:${submissionId}`, 1, 600))) {
    return fail("This request was already submitted. Check your tracking link or start a new request.");
  }

  const sb = createAdminSupabase();
  let facilityName = input.facilityName;
  let city = input.city;
  let lat = input.lat;
  let lng = input.lng;
  let centreId: string | null = null;
  if (input.facilityMode === "registered" && input.centreId) {
    const { data: centre } = await sb
      .from("blood_centres")
      .select("id,name,city,lat,lng,verification_status")
      .eq("id", input.centreId)
      .maybeSingle();
    if (!centre || centre.verification_status !== "verified") return fail("The selected facility is not available.");
    centreId = centre.id;
    facilityName = centre.name;
    city = centre.city;
    lat = Number(centre.lat);
    lng = Number(centre.lng);
  }

  const token = generateTrackingToken();
  const now = new Date();
  const { data, error } = await sb
    .from("blood_requests")
    .insert({
      reference: generateReference(),
      tracking_hash: hashTrackingToken(token),
      requester_id: requesterId,
      blood_group: input.bloodGroup,
      component: input.component,
      units: input.units,
      urgency: input.urgency,
      facility_name: facilityName,
      centre_id: centreId,
      city,
      location_detail: input.locationDetail || null,
      lat: roundCoordinate(lat, 3),
      lng: roundCoordinate(lng, 3),
      contact_name: input.contactName,
      contact_phone: input.contactPhone,
      contact_email: input.contactEmail || null,
      contact_pref: input.contactPref,
      consent_at: now.toISOString(),
      notes: input.notes || null,
      search_radius_km: initialRadiusKm(input.urgency),
      expires_at: computeExpiry(input.urgency, now).toISOString(),
    })
    .select("id,reference")
    .single();
  if (error || !data) return fail("We could not save your request. Please try again or contact the facility directly.");

  await sb.rpc("log_audit", {
    p_actor: requesterId,
    p_action: "request.created",
    p_entity_type: "blood_request",
    p_entity_id: data.id,
    p_meta: { urgency: input.urgency, component: input.component },
  });

  try {
    await runMatching(data.id);
  } catch {
    // The request is saved; matching is retried by maintenance.
  }
  return { ok: true, data: { token, reference: data.reference } };
}

export interface TrackingView {
  reference: string;
  status: RequestStatus;
  statusLabel: string;
  statusReason: string | null;
  terminal: boolean;
  bloodGroup: string;
  component: string;
  units: number;
  urgency: string;
  facilityName: string;
  city: string;
  createdAt: string;
  expiresAt: string;
  confirmedCentres: { name: string; phone: string; address: string; city: string }[];
  centresAwaiting: number;
  centresUnavailable: number;
  donorsWilling: number;
  donorsNotified: number;
  searchRadiusKm: number;
}

export async function getTrackingView(token: string, opts: { maintain?: boolean } = {}): Promise<TrackingView | null> {
  if (!isPlausibleToken(token)) return null;
  const sb = createAdminSupabase();
  const hash = hashTrackingToken(token);
  const lookup = () => sb.from("blood_requests").select("*").eq("tracking_hash", hash).maybeSingle();
  let { data: req } = await lookup();
  if (!req) return null;
  if (opts.maintain && !isTerminal(req.status)) {
    try {
      await maintainRequest(req.id);
      ({ data: req } = await lookup());
      if (!req) return null;
    } catch {
      // Show the last known state if maintenance fails.
    }
  }

  const { data: matches } = await sb.from("request_matches").select("candidate_type,status,centre_id").eq("request_id", req.id);
  const rows = matches ?? [];
  const confirmedIds = rows.filter((m) => m.candidate_type === "centre" && m.status === "confirmed").map((m) => m.centre_id as string);
  let confirmedCentres: TrackingView["confirmedCentres"] = [];
  if (confirmedIds.length) {
    const { data } = await sb.from("blood_centres").select("name,phone,address,city").in("id", confirmedIds);
    confirmedCentres = data ?? [];
  }
  const centreRows = rows.filter((m) => m.candidate_type === "centre");
  const donorRows = rows.filter((m) => m.candidate_type === "donor");
  return {
    reference: req.reference,
    status: req.status,
    statusLabel: STATUS_LABELS[req.status as RequestStatus],
    statusReason: req.status_reason,
    terminal: isTerminal(req.status),
    bloodGroup: req.blood_group,
    component: req.component,
    units: req.units,
    urgency: req.urgency,
    facilityName: req.facility_name,
    city: req.city,
    createdAt: req.created_at,
    expiresAt: req.expires_at,
    confirmedCentres,
    centresAwaiting: centreRows.filter((m) => m.status === "notified").length,
    centresUnavailable: centreRows.filter((m) => m.status === "unavailable" || m.status === "declined").length,
    donorsWilling: donorRows.filter((m) => m.status === "accepted").length,
    donorsNotified: donorRows.length,
    searchRadiusKm: req.search_radius_km,
  };
}

export async function cancelRequestByToken(token: string): Promise<ActionResult> {
  if (!isPlausibleToken(token)) return fail("Request not found.");
  if (!(await allowByClient("cancel", 10, 3600))) return fail("Too many attempts. Please wait and try again.");
  const sb = createAdminSupabase();
  const { data: req } = await sb.from("blood_requests").select("id,status").eq("tracking_hash", hashTrackingToken(token)).maybeSingle();
  if (!req) return fail("Request not found.");
  if (isTerminal(req.status)) return fail("This request is already closed.");
  const { error } = await sb.rpc("close_request", {
    p_request: req.id,
    p_status: "cancelled",
    p_reason: "Cancelled by the requester.",
    p_actor: null,
  });
  if (error) return fail("We could not cancel the request. Please try again.");
  return { ok: true, message: "Request cancelled." };
}
