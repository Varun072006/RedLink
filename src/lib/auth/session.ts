import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { homeFor, type Role } from "./roles";
import { createServerSupabase } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  status: "active" | "suspended";
  displayName: string;
  phone: string | null;
  notifyInApp: boolean;
  notifyPush: boolean;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status,display_name,phone,notify_in_app,notify_push")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role,
    status: profile.status,
    displayName: profile.display_name,
    phone: profile.phone,
    notifyInApp: profile.notify_in_app,
    notifyPush: profile.notify_push,
  };
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/auth/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (user.status !== "active") redirect("/auth/sign-in?error=suspended");
  return user;
}

export async function requireRole(roles: Role[], next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
