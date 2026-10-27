import { supplyGroupsFor, type BloodComponent, type BloodGroup } from "./blood";
import { compassDirection, haversineKm, type Point } from "./distance";
import { classifyFreshness, DEFAULT_FRESHNESS_POLICY, type FreshnessLevel, type FreshnessPolicy } from "./freshness";

export interface StockRow {
  bloodGroup: BloodGroup;
  component: BloodComponent;
  units: number;
  reserved: number;
  confirmedAt: string | null;
}

export interface SearchableCentre extends Point {
  id: string;
  name: string;
  kind: "hospital" | "blood_bank";
  city: string;
  address: string;
  phone: string;
  isSynthetic: boolean;
  stock: StockRow[];
}

export interface AvailabilityLine {
  bloodGroup: BloodGroup;
  available: number;
  confirmedAt: string | null;
  freshness: FreshnessLevel;
  exactGroup: boolean;
}

export interface AvailabilityResult {
  centre: SearchableCentre;
  lines: AvailabilityLine[];
  best: FreshnessLevel;
  distanceKm: number | null;
  direction: string | null;
}

const RANK: Record<FreshnessLevel, number> = { confirmed: 0, aging: 1, stale: 2, excluded: 3, unconfirmed: 4 };

export function searchAvailability(
  centres: readonly SearchableCentre[],
  query: { bloodGroup: BloodGroup; component: BloodComponent; origin?: Point | null; sort?: "distance" | "freshness" },
  now: Date,
  policy: FreshnessPolicy = DEFAULT_FRESHNESS_POLICY,
): AvailabilityResult[] {
  const groups = supplyGroupsFor(query.bloodGroup, query.component);
  const results: AvailabilityResult[] = [];
  for (const centre of centres) {
    const lines = centre.stock
      .filter((s) => s.component === query.component && groups.includes(s.bloodGroup) && s.units - s.reserved > 0)
      .map<AvailabilityLine>((s) => ({
        bloodGroup: s.bloodGroup,
        available: s.units - s.reserved,
        confirmedAt: s.confirmedAt,
        freshness: classifyFreshness(s.confirmedAt, now, policy),
        exactGroup: s.bloodGroup === query.bloodGroup,
      }))
      .sort((a, b) => RANK[a.freshness] - RANK[b.freshness] || Number(b.exactGroup) - Number(a.exactGroup) || b.available - a.available);
    if (!lines.length) continue;
    results.push({
      centre,
      lines,
      best: lines[0].freshness,
      distanceKm: query.origin ? haversineKm(query.origin, centre) : null,
      direction: query.origin ? compassDirection(query.origin, centre) : null,
    });
  }
  const byDistance = (a: AvailabilityResult, b: AvailabilityResult) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
  const byFresh = (a: AvailabilityResult, b: AvailabilityResult) => RANK[a.best] - RANK[b.best];
  const primary = query.sort === "distance" && query.origin ? [byDistance, byFresh] : [byFresh, byDistance];
  return results.sort((a, b) => primary[0](a, b) || primary[1](a, b) || a.centre.name.localeCompare(b.centre.name));
}
