import { haversineKm, roundCoordinate, type Point } from "./distance";
import { classifyFreshness, DEFAULT_FRESHNESS_POLICY, type FreshnessLevel, type FreshnessPolicy } from "./freshness";
import { supplyGroupsFor, type BloodComponent, type BloodGroup } from "./blood";

export interface MatchRequest extends Point {
  bloodGroup: BloodGroup;
  component: BloodComponent;
  units: number;
  radiusKm: number;
  excludeCentreIds?: readonly string[];
  excludeDonorIds?: readonly string[];
}

export interface CentreStock {
  bloodGroup: BloodGroup;
  component: BloodComponent;
  available: number;
  confirmedAt: string | null;
}

export interface CentreCandidateInput extends Point {
  id: string;
  name: string;
  verified: boolean;
  stock: readonly CentreStock[];
}

export interface DonorCandidateInput extends Point {
  id: string;
  bloodGroup: BloodGroup;
  availability: "available" | "paused" | "unavailable";
  optedIn: boolean;
  lastDonationOn: string | null;
}

export interface RationaleItem {
  factor: string;
  points: number;
  detail: string;
}

export interface CentreMatch {
  type: "centre";
  id: string;
  name: string;
  supplyGroup: BloodGroup;
  availableUnits: number;
  freshness: FreshnessLevel;
  distanceKm: number;
  score: number;
  rationale: RationaleItem[];
}

export interface DonorMatch {
  type: "donor";
  id: string;
  distanceKm: number;
  score: number;
  rationale: RationaleItem[];
}

export interface Exclusion {
  type: "centre" | "donor";
  id: string;
  reason: string;
}

export interface MatchResult {
  centres: CentreMatch[];
  donors: DonorMatch[];
  excluded: Exclusion[];
}

export interface MatchConfig {
  freshness: FreshnessPolicy;
  donorCooldownDays: number;
  weights: {
    freshness: Record<"confirmed" | "aging" | "stale", number>;
    fullStock: number;
    partialStock: number;
    proximityMax: number;
    exactGroup: number;
    donorBase: number;
    donorProximityMax: number;
  };
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  freshness: DEFAULT_FRESHNESS_POLICY,
  donorCooldownDays: 90,
  weights: {
    freshness: { confirmed: 50, aging: 30, stale: 10 },
    fullStock: 20,
    partialStock: 8,
    proximityMax: 30,
    exactGroup: 5,
    donorBase: 20,
    donorProximityMax: 30,
    },
};

const proximityPoints = (distanceKm: number, radiusKm: number, max: number) =>
  Math.round(max * Math.max(0, 1 - distanceKm / radiusKm) * 10) / 10;

export function matchRequest(
  request: MatchRequest,
  centres: readonly CentreCandidateInput[],
  donors: readonly DonorCandidateInput[],
  now: Date,
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
): MatchResult {
  const w = config.weights;
  const supply = supplyGroupsFor(request.bloodGroup, request.component);
  const excluded: Exclusion[] = [];
  const centreMatches: CentreMatch[] = [];
  const donorMatches: DonorMatch[] = [];

  for (const c of centres) {
    if (request.excludeCentreIds?.includes(c.id)) {
      excluded.push({ type: "centre", id: c.id, reason: "already contacted for this request" });
      continue;
    }
    if (!c.verified) {
      excluded.push({ type: "centre", id: c.id, reason: "facility not verified" });
      continue;
    }
    const distanceKm = haversineKm(request, c);
    if (distanceKm > request.radiusKm) {
      excluded.push({ type: "centre", id: c.id, reason: "outside search radius" });
      continue;
    }
    let best: { stock: CentreStock; level: FreshnessLevel } | null = null;
    let sawStale = false;
    let sawStock = false;
    for (const s of c.stock) {
      if (s.component !== request.component || !supply.includes(s.bloodGroup) || s.available <= 0) continue;
      sawStock = true;
      const level = classifyFreshness(s.confirmedAt, now, config.freshness);
      if (level === "unconfirmed" || level === "excluded") {
        sawStale = true;
        continue;
      }
      const rank = (x: { stock: CentreStock; level: FreshnessLevel }) =>
        [x.level === "confirmed" ? 2 : x.level === "aging" ? 1 : 0, x.stock.bloodGroup === request.bloodGroup ? 1 : 0, x.stock.available];
      const cand = { stock: s, level };
      if (!best) best = cand;
      else {
        const a = rank(cand);
        const b = rank(best);
        if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) best = cand;
      }
    }
    if (!best) {
      excluded.push({
        type: "centre",
        id: c.id,
        reason: sawStale ? "stock confirmation too old or missing" : sawStock ? "no usable stock" : "no compatible stock listed",
      });
      continue;
    }
    const rationale: RationaleItem[] = [];
    const level = best.level as "confirmed" | "aging" | "stale";
    rationale.push({ factor: "freshness", points: w.freshness[level], detail: `stock confirmation is ${level}` });
    const full = best.stock.available >= request.units;
    rationale.push({
      factor: "stock",
      points: full ? w.fullStock : w.partialStock,
      detail: full ? `lists ${best.stock.available} units, enough for ${request.units}` : `lists ${best.stock.available} units, fewer than ${request.units} needed`,
    });
    rationale.push({
      factor: "proximity",
      points: proximityPoints(distanceKm, request.radiusKm, w.proximityMax),
      detail: `${distanceKm.toFixed(1)} km within a ${request.radiusKm} km radius`,
    });
    if (best.stock.bloodGroup === request.bloodGroup) {
      rationale.push({ factor: "exact_group", points: w.exactGroup, detail: "same blood group as requested" });
    }
    centreMatches.push({
      type: "centre",
      id: c.id,
      name: c.name,
      supplyGroup: best.stock.bloodGroup,
      availableUnits: best.stock.available,
      freshness: best.level,
      distanceKm: roundCoordinate(distanceKm, 1),
      score: Math.round(rationale.reduce((s, r) => s + r.points, 0) * 10) / 10,
      rationale,
    });
  }

  for (const d of donors) {
    if (request.excludeDonorIds?.includes(d.id)) {
      excluded.push({ type: "donor", id: d.id, reason: "already contacted for this request" });
      continue;
    }
    if (!d.optedIn) {
      excluded.push({ type: "donor", id: d.id, reason: "no consent to receive requests" });
      continue;
    }
    if (d.availability !== "available") {
      excluded.push({ type: "donor", id: d.id, reason: `donor is ${d.availability}` });
      continue;
    }
    if (!supply.includes(d.bloodGroup)) {
      excluded.push({ type: "donor", id: d.id, reason: "blood group fails preliminary filter" });
      continue;
    }
    if (d.lastDonationOn) {
      const days = (now.getTime() - new Date(d.lastDonationOn).getTime()) / 86_400_000;
      if (days < config.donorCooldownDays) {
        excluded.push({ type: "donor", id: d.id, reason: "within configured donation interval" });
        continue;
      }
    }
    const distanceKm = haversineKm(request, d);
    if (distanceKm > request.radiusKm) {
      excluded.push({ type: "donor", id: d.id, reason: "outside search radius" });
      continue;
    }
    const rationale: RationaleItem[] = [
      { factor: "willingness", points: w.donorBase, detail: "opted in and currently available (self-reported, not verified)" },
      {
        factor: "proximity",
        points: proximityPoints(distanceKm, request.radiusKm, w.donorProximityMax),
        detail: `about ${distanceKm.toFixed(0)} km away`,
      },
    ];
    if (d.bloodGroup === request.bloodGroup) {
      rationale.push({ factor: "exact_group", points: w.exactGroup, detail: "same blood group as requested" });
    }
    donorMatches.push({
      type: "donor",
      id: d.id,
      distanceKm: roundCoordinate(distanceKm, 1),
      score: Math.round(rationale.reduce((s, r) => s + r.points, 0) * 10) / 10,
      rationale,
    });
  }

  const byScore = <T extends { score: number; distanceKm: number; id: string }>(a: T, b: T) =>
    b.score - a.score || a.distanceKm - b.distanceKm || a.id.localeCompare(b.id);
  return { centres: centreMatches.sort(byScore), donors: donorMatches.sort(byScore), excluded };
}

export function nearestFirstBaseline(
  request: MatchRequest,
  centres: readonly CentreCandidateInput[],
): { id: string; distanceKm: number }[] {
  return centres
    .filter((c) => c.verified)
    .map((c) => ({ id: c.id, distanceKm: haversineKm(request, c) }))
    .filter((c) => c.distanceKm <= request.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
}
