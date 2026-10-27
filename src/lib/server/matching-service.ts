import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { donorCooldownDays, freshnessPolicy } from "@/lib/env";
import { supplyGroupsFor, type BloodComponent, type BloodGroup, type Urgency } from "@/lib/domain/blood";
import {
  DEFAULT_MATCH_CONFIG,
  matchRequest,
  type CentreCandidateInput,
  type DonorCandidateInput,
} from "@/lib/domain/matching";
import { dispatchPendingPush } from "./push";
import { nextSearchRadius, isTerminal, type RequestStatus } from "@/lib/domain/request-state";

const MAX_CENTRES_NOTIFIED = 5;
const MAX_DONORS_NOTIFIED = 10;
const MATCH_WINDOW_MINUTES: Record<Urgency, number> = { critical: 30, urgent: 120, standard: 720 };
const FALLBACK_AFTER_MINUTES: Record<Urgency, number> = { critical: 15, urgent: 60, standard: 360 };

interface RequestRow {
  id: string;
  blood_group: BloodGroup;
  component: BloodComponent;
  units: number;
  urgency: Urgency;
  status: RequestStatus;
  lat: number;
  lng: number;
  search_radius_km: number;
  match_attempts: number;
  last_matched_at: string | null;
  expires_at: string;
}

function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export async function runMatching(requestId: string, now = new Date()) {
  const sb = createAdminSupabase();
  const { data: req } = await sb.from("blood_requests").select("*").eq("id", requestId).maybeSingle<RequestRow>();
  if (!req || isTerminal(req.status)) return { centres: 0, donors: 0 };

  if (req.status === "submitted") {
    await sb.from("blood_requests").update({ status: "matching" }).eq("id", req.id);
    req.status = "matching";
  }

  const { data: existing } = await sb.from("request_matches").select("centre_id,donor_id").eq("request_id", req.id);
  const excludeCentreIds = (existing ?? []).map((m) => m.centre_id).filter(Boolean) as string[];
  const excludeDonorIds = (existing ?? []).map((m) => m.donor_id).filter(Boolean) as string[];

  const supply = supplyGroupsFor(req.blood_group, req.component);
  const box = boundingBox(Number(req.lat), Number(req.lng), req.search_radius_km);

  const [{ data: centreRows }, { data: donorRows }] = await Promise.all([
    sb
      .from("blood_centres")
      .select("id,name,lat,lng,verification_status,blood_inventory(blood_group,component,units,reserved,last_confirmed_at)")
      .eq("verification_status", "verified")
      .eq("is_synthetic", false)
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat)
      .gte("lng", box.minLng)
      .lte("lng", box.maxLng),
    sb
      .from("donor_profiles")
      .select("user_id,blood_group,availability,opted_in,last_donation_on,lat,lng")
      .eq("opted_in", true)
      .eq("availability", "available")
      .in("blood_group", supply)
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat)
      .gte("lng", box.minLng)
      .lte("lng", box.maxLng),
  ]);

  const centres: CentreCandidateInput[] = (centreRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    lat: Number(c.lat),
    lng: Number(c.lng),
    verified: c.verification_status === "verified",
    stock: (c.blood_inventory ?? []).map((i) => ({
      bloodGroup: i.blood_group as BloodGroup,
      component: i.component as BloodComponent,
      available: Math.max(0, i.units - i.reserved),
      confirmedAt: i.last_confirmed_at,
    })),
  }));
  const donors: DonorCandidateInput[] = (donorRows ?? []).map((d) => ({
    id: d.user_id,
    bloodGroup: d.blood_group as BloodGroup,
    availability: d.availability,
    optedIn: d.opted_in,
    lastDonationOn: d.last_donation_on,
    lat: Number(d.lat),
    lng: Number(d.lng),
  }));

  const result = matchRequest(
    {
      lat: Number(req.lat),
      lng: Number(req.lng),
      bloodGroup: req.blood_group,
      component: req.component,
      units: req.units,
      radiusKm: req.search_radius_km,
      excludeCentreIds,
      excludeDonorIds,
    },
    centres,
    donors,
    now,
    { ...DEFAULT_MATCH_CONFIG, freshness: freshnessPolicy(), donorCooldownDays: donorCooldownDays() },
  );

  const windowEnd = new Date(
    Math.min(new Date(req.expires_at).getTime(), now.getTime() + MATCH_WINDOW_MINUTES[req.urgency] * 60_000),
  ).toISOString();

  const chosenCentres = result.centres.slice(0, MAX_CENTRES_NOTIFIED);
  const chosenDonors = result.donors.slice(0, MAX_DONORS_NOTIFIED);

  if (chosenCentres.length) {
    await sb.from("request_matches").upsert(
      chosenCentres.map((c) => ({
        request_id: req.id,
        candidate_type: "centre",
        centre_id: c.id,
        supply_group: c.supplyGroup,
        score: c.score,
        distance_km: c.distanceKm,
        rationale: c.rationale,
        expires_at: windowEnd,
      })),
      { onConflict: "request_id,centre_id", ignoreDuplicates: true },
    );
  }
  if (chosenDonors.length) {
    await sb.from("request_matches").upsert(
      chosenDonors.map((d) => ({
        request_id: req.id,
        candidate_type: "donor",
        donor_id: d.id,
        score: d.score,
        distance_km: d.distanceKm,
        rationale: d.rationale,
        expires_at: windowEnd,
      })),
      { onConflict: "request_id,donor_id", ignoreDuplicates: true },
    );
  }

  for (const c of chosenCentres) {
    const { data: staff } = await sb.from("centre_staff").select("user_id").eq("centre_id", c.id);
    for (const s of staff ?? []) {
      await sb.rpc("notify_user", {
        p_user: s.user_id,
        p_type: "request_match",
        p_title: `New ${req.urgency} request: ${req.units} unit(s) ${req.blood_group}`,
        p_body: "Confirm availability only if you hold unreserved stock.",
        p_link: "/hospital/requests",
      });
    }
  }
  for (const d of chosenDonors) {
    await sb.rpc("notify_user", {
      p_user: d.id,
      p_type: "request_match",
      p_title: `Nearby request for ${req.blood_group} blood`,
      p_body: "Opening it does not commit you. Accepting does not confirm medical eligibility.",
      p_link: "/donor/dashboard",
    });
  }

  const notified = chosenCentres.length + chosenDonors.length;
  const patch: Record<string, unknown> = { match_attempts: req.match_attempts + 1, last_matched_at: now.toISOString() };
  if (notified > 0 && req.status === "matching") patch.status = "awaiting_response";
  await sb.from("blood_requests").update(patch).eq("id", req.id);
  await sb.rpc("log_audit", {
    p_actor: null,
    p_action: "request.matched",
    p_entity_type: "blood_request",
    p_entity_id: req.id,
    p_meta: {
      radius_km: req.search_radius_km,
      centres: chosenCentres.length,
      donors: chosenDonors.length,
      excluded: result.excluded.length,
    },
  });
  await dispatchPendingPush().catch(() => undefined);
  return { centres: chosenCentres.length, donors: chosenDonors.length };
}

export async function maintainRequest(requestId: string, now = new Date()): Promise<void> {
  const sb = createAdminSupabase();
  const { data: req } = await sb.from("blood_requests").select("*").eq("id", requestId).maybeSingle<RequestRow>();
  if (!req || isTerminal(req.status)) return;

  if (new Date(req.expires_at).getTime() <= now.getTime()) {
    await sb.rpc("close_request", { p_request: req.id, p_status: "expired", p_reason: "The request reached its expiry time." });
    return;
  }

  await sb
    .from("request_matches")
    .update({ status: "timeout", responded_at: now.toISOString() })
    .eq("request_id", req.id)
    .eq("status", "notified")
    .lt("expires_at", now.toISOString());

  if (req.status === "availability_confirmed") return;

  const { count: live } = await sb
    .from("request_matches")
    .select("id", { count: "exact", head: true })
    .eq("request_id", req.id)
    .in("status", ["notified", "accepted", "confirmed"]);
  const sinceMatch = req.last_matched_at ? now.getTime() - new Date(req.last_matched_at).getTime() : Infinity;
  const due = sinceMatch >= FALLBACK_AFTER_MINUTES[req.urgency] * 60_000;
  const noPendingCentre = await sb
    .from("request_matches")
    .select("id", { count: "exact", head: true })
    .eq("request_id", req.id)
    .eq("candidate_type", "centre")
    .in("status", ["notified", "confirmed"])
    .then((r) => (r.count ?? 0) === 0);

  if (!(due && (noPendingCentre || (live ?? 0) === 0)) && req.last_matched_at) return;

  const widened = nextSearchRadius(req.search_radius_km);
  if (widened === null) {
    if ((live ?? 0) === 0 && req.last_matched_at) {
      await sb.rpc("close_request", {
        p_request: req.id,
        p_status: "unresolved",
        p_reason: "No further sources were found within the maximum search radius.",
      });
    }
    return;
  }
  if (req.last_matched_at) await sb.from("blood_requests").update({ search_radius_km: widened }).eq("id", req.id);
  await runMatching(req.id, now);
}

export async function maintainActiveRequests(limit = 200): Promise<{ processed: number }> {
  const sb = createAdminSupabase();
  const { data } = await sb
    .from("blood_requests")
    .select("id")
    .in("status", ["submitted", "matching", "awaiting_response", "availability_confirmed"])
    .order("created_at", { ascending: true })
    .limit(limit);
  for (const r of data ?? []) {
    try {
      await maintainRequest(r.id);
    } catch {
      // One failing request must not stop the batch; it is retried on the next run.
    }
  }
  return { processed: data?.length ?? 0 };
}
