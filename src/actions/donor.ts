"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { dispatchPendingPush } from "@/lib/server/push";
import { dbFail, fail, zodFail, type ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/auth/session";
import { COARSE_DECIMALS, roundCoordinate } from "@/lib/domain/distance";
import { donorProfileSchema } from "@/lib/domain/schemas";
import { createServerSupabase } from "@/lib/supabase/server";

export async function saveDonorProfileAction(input: unknown): Promise<ActionResult> {
  const user = await requireRole(["donor"]);
  const parsed = donorProfileSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase.from("donor_profiles").select("opted_in,consent_at").eq("user_id", user.id).maybeSingle();
  const consentAt = v.optedIn ? (existing?.opted_in && existing.consent_at ? existing.consent_at : new Date().toISOString()) : null;
  const row = {
    blood_group: v.bloodGroup,
    city: v.city,
    lat: roundCoordinate(v.lat, COARSE_DECIMALS),
    lng: roundCoordinate(v.lng, COARSE_DECIMALS),
    last_donation_on: v.lastDonationOn || null,
    opted_in: v.optedIn,
    consent_at: consentAt,
    availability: v.optedIn ? v.availability : "unavailable",
  };
  const { error } = existing
    ? await supabase.from("donor_profiles").update(row).eq("user_id", user.id)
    : await supabase.from("donor_profiles").insert({ ...row, user_id: user.id });
  if (error) return fail("We could not save your profile. Please check the details and try again.");
  revalidatePath("/donor/profile");
  revalidatePath("/donor/dashboard");
  return { ok: true, message: "Profile saved." };
}

export async function setAvailabilityAction(availability: string): Promise<ActionResult> {
  const user = await requireRole(["donor"]);
  if (!["available", "paused", "unavailable"].includes(availability)) return fail("Invalid availability.");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("donor_profiles")
    .update({ availability })
    .eq("user_id", user.id)
    .select("user_id");
  if (error || !data?.length) return fail("Complete your donor profile and opt in before becoming available.");
  revalidatePath("/donor/dashboard");
  return { ok: true, message: "Availability updated." };
}

export async function respondToMatchAction(matchId: string, accept: boolean): Promise<ActionResult> {
  await requireRole(["donor"]);
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return fail("Request not found.");
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("respond_to_match", { p_match: matchId, p_accept: accept });
  if (error) return dbFail(error);
  after(() => dispatchPendingPush());
  revalidatePath("/donor/dashboard");
  return {
    ok: true,
    message: accept ? "Thank you. Your willingness was shared. This does not confirm eligibility." : "Declined.",
  };
}
