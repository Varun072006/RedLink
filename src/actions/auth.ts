"use server";

import { redirect } from "next/navigation";
import { fail, zodFail, type ActionResult } from "@/lib/action-result";
import { forgotSchema, newPasswordSchema, signInSchema, signUpSchema } from "@/lib/domain/schemas";
import { isSupabaseConfigured, isServiceConfigured, siteUrl } from "@/lib/env";
import { allowByClient } from "@/lib/server/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";
import { homeFor, type Role } from "@/lib/auth/roles";
import { safeNext } from "@/lib/safe-next";

const NOT_CONFIGURED = "The backend is not configured for this deployment yet. See the setup notes.";

async function throttle(action: string, max: number, windowSeconds: number) {
  if (!isServiceConfigured()) return true;
  return allowByClient(action, max, windowSeconds);
}

export async function signUpAction(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  if (!isSupabaseConfigured()) return fail(NOT_CONFIGURED);
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  if (!(await throttle("signup", 10, 3600))) return fail("Too many sign-up attempts. Please try again later.");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName, role: parsed.data.role },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });
  if (error) return fail("We could not create the account. Check your details or try signing in.");
  return { ok: true, data: { needsConfirmation: !data.session } };
}

export async function signInAction(input: unknown, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  if (!isSupabaseConfigured()) return fail(NOT_CONFIGURED);
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  if (!(await throttle("signin", 15, 900))) return fail("Too many sign-in attempts. Please wait a few minutes.");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return fail("Incorrect email or password.");
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return fail("This account is not active. Contact the platform administrators.");
  }
  return { ok: true, data: { redirectTo: safeNext(next, homeFor(profile.role as Role)) } };
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return fail(NOT_CONFIGURED);
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  if (!(await throttle("forgot", 5, 3600))) return fail("Too many requests. Please try again later.");
  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/update-password`,
  });
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePasswordAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return fail(NOT_CONFIGURED);
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("Your reset link has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("We could not update the password. Try a different one.");
  return { ok: true, message: "Password updated." };
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/");
}
