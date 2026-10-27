export type FreshnessLevel = "confirmed" | "aging" | "stale" | "excluded" | "unconfirmed";

export interface FreshnessPolicy {
  freshMinutes: number;
  staleHours: number;
  excludeHours: number;
}

export const DEFAULT_FRESHNESS_POLICY: FreshnessPolicy = {
  freshMinutes: 240,
  staleHours: 24,
  excludeHours: 72,
};

export function freshnessPolicyFromEnv(env: Record<string, string | undefined>): FreshnessPolicy {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n > 0 ? n : d;
  };
  const policy = {
    freshMinutes: num(env.FRESH_MINUTES, DEFAULT_FRESHNESS_POLICY.freshMinutes),
    staleHours: num(env.STALE_HOURS, DEFAULT_FRESHNESS_POLICY.staleHours),
    excludeHours: num(env.EXCLUDE_HOURS, DEFAULT_FRESHNESS_POLICY.excludeHours),
  };
  if (policy.freshMinutes > policy.staleHours * 60 || policy.staleHours > policy.excludeHours) {
    return DEFAULT_FRESHNESS_POLICY;
  }
  return policy;
}

export function classifyFreshness(
  confirmedAt: Date | string | null | undefined,
  now: Date,
  policy: FreshnessPolicy = DEFAULT_FRESHNESS_POLICY,
): FreshnessLevel {
  if (!confirmedAt) return "unconfirmed";
  const t = new Date(confirmedAt).getTime();
  if (Number.isNaN(t) || t > now.getTime() + 60_000) return "unconfirmed";
  const ageMin = (now.getTime() - t) / 60_000;
  if (ageMin <= policy.freshMinutes) return "confirmed";
  if (ageMin <= policy.staleHours * 60) return "aging";
  if (ageMin <= policy.excludeHours * 60) return "stale";
  return "excluded";
}

export function isConfirmedStock(level: FreshnessLevel): boolean {
  return level === "confirmed";
}

export const FRESHNESS_LABELS: Record<FreshnessLevel, string> = {
  confirmed: "Confirmed recently",
  aging: "Confirmed earlier, call to verify",
  stale: "Stale, needs reconfirmation",
  excluded: "Not confirmed in a long time",
  unconfirmed: "Never confirmed",
};

export function formatAge(confirmedAt: Date | string | null | undefined, now: Date): string {
  if (!confirmedAt) return "never confirmed";
  const mins = Math.max(0, Math.round((now.getTime() - new Date(confirmedAt).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
