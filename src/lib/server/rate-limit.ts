import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminSupabase().rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) return false;
  return data === true;
}

export async function allowByClient(action: string, max: number, windowSeconds: number): Promise<boolean> {
  return allow(`${action}:${await clientFingerprint()}`, max, windowSeconds);
}
