"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, zodFail, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { profileSettingsSchema } from "@/lib/domain/schemas";
import { isPushConfigured, isServiceConfigured } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser("/settings");
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName, phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) return fail("We could not save your details.");
  revalidatePath("/settings");
  return { ok: true, message: "Details saved." };
}

export async function setNotificationPrefsAction(inApp: boolean, push: boolean): Promise<ActionResult> {
  const user = await requireUser("/settings");
  if (push && !isPushConfigured()) return fail("Push notifications are not enabled on this deployment.");
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("profiles").update({ notify_in_app: inApp, notify_push: push }).eq("id", user.id);
  if (error) return fail("We could not save your preferences.");
  revalidatePath("/settings");
  return { ok: true, message: "Preferences saved." };
}

export async function savePushSubscriptionAction(sub: { endpoint: string; p256dh: string; auth: string }): Promise<ActionResult> {
  const user = await requireUser("/settings");
  if (!isPushConfigured()) return fail("Push notifications are not enabled on this deployment.");
  if (!sub.endpoint.startsWith("https://") || sub.endpoint.length > 1000 || !sub.p256dh || !sub.auth) return fail("Invalid subscription.");
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, { onConflict: "endpoint" });
  if (error) return fail("We could not save the subscription.");
  return setNotificationPrefsAction(user.notifyInApp, true);
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  const user = await requireUser("/settings");
  const supabase = await createServerSupabase();
  await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  const { count } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true });
  if (!count) await supabase.from("profiles").update({ notify_push: false }).eq("id", user.id);
  revalidatePath("/settings");
  return { ok: true };
}

export async function markNotificationsReadAction(id?: string): Promise<ActionResult> {
  const user = await requireUser("/notifications");
  const supabase = await createServerSupabase();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Not found.");
    q = q.eq("id", id);
  }
  const { error } = await q;
  if (error) return fail("We could not update notifications.");
  revalidatePath("/notifications");
  return { ok: true };
}

export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  const user = await requireUser("/settings");
  if (confirmation.trim().toUpperCase() !== "DELETE") return fail("Type DELETE to confirm.");
  if (user.role === "admin") return fail("Administrator accounts cannot be deleted from here.");
  if (!isServiceConfigured()) return fail("Backend is not configured.");
  const sb = createAdminSupabase();
  await sb.rpc("log_audit", { p_actor: user.id, p_action: "account.deleted", p_entity_type: "profile", p_entity_id: user.id, p_meta: {} });
  const { error } = await sb.auth.admin.deleteUser(user.id);
  if (error) return fail("We could not delete the account. Please try again.");
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
