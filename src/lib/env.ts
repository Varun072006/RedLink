import { freshnessPolicyFromEnv } from "./domain/freshness";

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function isServiceConfigured(): boolean {
  return isSupabaseConfigured() && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function isGeocodeConfigured(): boolean {
  return !!process.env.GEOCODE_URL;
}

export function isPushConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");
}

export function freshnessPolicy() {
  return freshnessPolicyFromEnv(process.env);
}

export function donorCooldownDays(): number {
  const n = Number(process.env.DONOR_COOLDOWN_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 90;
}
