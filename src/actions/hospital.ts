"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { dispatchPendingPush } from "@/lib/server/push";
import { dbFail, fail, zodFail, type ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/auth/session";
import { centreRegistrationSchema, inventoryDeltaSchema, inventorySetSchema } from "@/lib/domain/schemas";
import { roundCoordinate } from "@/lib/domain/distance";
import { createServerSupabase } from "@/lib/supabase/server";

const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function registerCentreAction(input: unknown): Promise<ActionResult> {
  await requireRole(["staff"]);
  const parsed = centreRegistrationSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("register_centre", {
    p_name: v.name,
    p_kind: v.kind,
    p_city: v.city,
    p_address: v.address,
    p_lat: roundCoordinate(v.lat, 5),
    p_lng: roundCoordinate(v.lng, 5),
    p_phone: v.phone,
    p_license_ref: v.licenseRef,
  });
  if (error) return dbFail(error, "We could not submit the registration.");
  revalidatePath("/hospital/dashboard");
  return { ok: true, message: "Submitted for verification." };
}

export async function setInventoryAction(input: unknown): Promise<ActionResult> {
  await requireRole(["staff"]);
  const parsed = inventorySetSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("set_inventory", {
    p_group: parsed.data.bloodGroup,
    p_component: parsed.data.component,
    p_units: parsed.data.units,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return dbFail(error);
  revalidatePath("/hospital/inventory");
  return { ok: true, message: "Stock count saved and confirmed." };
}

export async function adjustInventoryAction(input: unknown): Promise<ActionResult> {
  await requireRole(["staff"]);
  const parsed = inventoryDeltaSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("adjust_inventory", {
    p_group: parsed.data.bloodGroup,
    p_component: parsed.data.component,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
  });
  if (error) return dbFail(error);
  revalidatePath("/hospital/inventory");
  return { ok: true, message: "Adjustment recorded." };
}

export async function confirmInventoryAction(): Promise<ActionResult> {
  await requireRole(["staff"]);
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("confirm_inventory");
  if (error) return dbFail(error);
  revalidatePath("/hospital/inventory");
  revalidatePath("/hospital/dashboard");
  return { ok: true, message: "All listed stock marked as confirmed now." };
}

export async function centreRespondAction(matchId: string, action: "confirm" | "unavailable"): Promise<ActionResult> {
  await requireRole(["staff"]);
  if (!uuid(matchId) || !["confirm", "unavailable"].includes(action)) return fail("Request not found.");
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("centre_respond", { p_match: matchId, p_action: action });
  if (error) return dbFail(error);
  after(() => dispatchPendingPush());
  revalidatePath("/hospital/requests");
  return { ok: true, message: action === "confirm" ? "Availability confirmed and units reserved." : "Marked unavailable." };
}

export async function fulfilRequestAction(matchId: string): Promise<ActionResult> {
  await requireRole(["staff"]);
  if (!uuid(matchId)) return fail("Request not found.");
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("fulfil_request", { p_match: matchId });
  if (error) return dbFail(error);
  after(() => dispatchPendingPush());
  revalidatePath("/hospital/requests");
  revalidatePath("/hospital/inventory");
  return { ok: true, message: "Marked fulfilled and stock updated." };
}

export async function releaseReservationAction(matchId: string): Promise<ActionResult> {
  await requireRole(["staff"]);
  if (!uuid(matchId)) return fail("Request not found.");
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("release_reservation", { p_match: matchId });
  if (error) return dbFail(error);
  revalidatePath("/hospital/requests");
  return { ok: true, message: "Reservation released." };
}

export async function flagRequestAction(requestId: string, reason: string): Promise<ActionResult> {
  await requireRole(["staff"]);
  const text = reason.trim();
  if (!uuid(requestId) || text.length < 3 || text.length > 500) return fail("Describe the concern in 3 to 500 characters.");
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("flag_request", { p_request: requestId, p_reason: text });
  if (error) return dbFail(error);
  revalidatePath("/hospital/requests");
  return { ok: true, message: "Reported to administrators." };
}

export async function recordDonationAction(code: string): Promise<ActionResult> {
  await requireRole(["staff"]);
  const clean = code.trim();
  if (!/^[A-Za-z0-9]{8}$/.test(clean)) return fail("Donor codes have 8 letters or digits.");
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("record_donation", { p_code: clean, p_request: null });
  if (error) return dbFail(error);
  return { ok: true, message: "Verified donation recorded." };
}

export async function updateCentreProfileAction(input: unknown): Promise<ActionResult> {
  await requireRole(["staff"]);
  const parsed = centreRegistrationSchema.omit({ kind: true, licenseRef: true }).safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("update_centre_profile", {
    p_name: v.name,
    p_city: v.city,
    p_address: v.address,
    p_lat: roundCoordinate(v.lat, 5),
    p_lng: roundCoordinate(v.lng, 5),
    p_phone: v.phone,
  });
  if (error) return dbFail(error);
  revalidatePath("/hospital/dashboard");
  return { ok: true, message: "Facility profile updated." };
}
