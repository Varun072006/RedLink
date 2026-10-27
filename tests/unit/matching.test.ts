import { describe, expect, it } from "vitest";
import {
  matchRequest,
  nearestFirstBaseline,
  type CentreCandidateInput,
  type DonorCandidateInput,
  type MatchRequest,
} from "@/lib/domain/matching";

const now = new Date("2026-01-01T12:00:00Z");
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
const origin = { lat: 12.97, lng: 77.59 };
const request: MatchRequest = { ...origin, bloodGroup: "O+", component: "red_cells", units: 2, radiusKm: 25 };

const centre = (
  id: string,
  dLat: number,
  stock: { g?: string; available: number; confirmedAt: string | null },
  verified = true,
): CentreCandidateInput => ({
  id,
  name: id,
  verified,
  lat: origin.lat + dLat,
  lng: origin.lng,
  stock: [{ bloodGroup: (stock.g ?? "O+") as "O+", component: "red_cells", available: stock.available, confirmedAt: stock.confirmedAt }],
});

const donor = (id: string, over: Partial<DonorCandidateInput> = {}): DonorCandidateInput => ({
  id,
  bloodGroup: "O+",
  availability: "available",
  optedIn: true,
  lastDonationOn: null,
  lat: origin.lat + 0.02,
  lng: origin.lng,
  ...over,
});

describe("matching filters", () => {
  it("excludes unverified, stale-expired, unconfirmed, out-of-radius and incompatible centres with reasons", () => {
    const res = matchRequest(
      request,
      [
        centre("ok", 0.05, { available: 5, confirmedAt: minsAgo(30) }),
        centre("unverified", 0.01, { available: 5, confirmedAt: minsAgo(30) }, false),
        centre("old", 0.01, { available: 5, confirmedAt: minsAgo(60 * 100) }),
        centre("never", 0.01, { available: 5, confirmedAt: null }),
        centre("far", 2, { available: 5, confirmedAt: minsAgo(30) }),
        centre("wrong", 0.01, { g: "A+", available: 5, confirmedAt: minsAgo(30) }),
        centre("empty", 0.01, { available: 0, confirmedAt: minsAgo(30) }),
      ],
      [],
      now,
    );
    expect(res.centres.map((c) => c.id)).toEqual(["ok"]);
    const reasons = Object.fromEntries(res.excluded.map((e) => [e.id, e.reason]));
    expect(reasons.unverified).toMatch(/not verified/);
    expect(reasons.old).toMatch(/too old/);
    expect(reasons.never).toMatch(/too old|missing/);
    expect(reasons.far).toMatch(/radius/);
    expect(reasons.wrong).toMatch(/no compatible/);
    expect(reasons.empty).toMatch(/compatible|usable/);
  });

  it("filters donors by consent, availability, blood group, cooldown, radius and prior contact", () => {
    const res = matchRequest(
      request,
      [],
      [
        donor("ok"),
        donor("noconsent", { optedIn: false }),
        donor("paused", { availability: "paused" }),
        donor("wronggroup", { bloodGroup: "A+" }),
        donor("recent", { lastDonationOn: "2025-12-01" }),
        donor("old-donation", { lastDonationOn: "2025-06-01" }),
        donor("far", { lat: origin.lat + 3 }),
        donor("contacted"),
      ],
      now,
      undefined,
    );
    const ids = res.donors.map((d) => d.id).sort();
    expect(ids).toEqual(["contacted", "ok", "old-donation"]);
    const res2 = matchRequest({ ...request, excludeDonorIds: ["contacted"] }, [], [donor("contacted")], now);
    expect(res2.donors).toHaveLength(0);
  });

  it("keeps centres and donors as separate categories", () => {
    const res = matchRequest(request, [centre("c", 0.01, { available: 3, confirmedAt: minsAgo(10) })], [donor("d")], now);
    expect(res.centres).toHaveLength(1);
    expect(res.donors).toHaveLength(1);
    expect(res.centres[0].type).toBe("centre");
    expect(res.donors[0].type).toBe("donor");
  });
});

describe("matching ranking and rationale", () => {
  it("ranks a fresh well-stocked centre above a nearer stale one, unlike nearest-first", () => {
    const nearStale = centre("near-stale", 0.01, { available: 1, confirmedAt: minsAgo(60 * 40) });
    const farFresh = centre("far-fresh", 0.12, { available: 6, confirmedAt: minsAgo(20) });
    const res = matchRequest(request, [nearStale, farFresh], [], now);
    expect(res.centres.map((c) => c.id)).toEqual(["far-fresh", "near-stale"]);
    const baseline = nearestFirstBaseline(request, [nearStale, farFresh]);
    expect(baseline[0].id).toBe("near-stale");
    expect(res.centres[0].freshness).toBe("confirmed");
    expect(res.centres[1].freshness).toBe("stale");
  });

  it("records a rationale whose points sum to the score", () => {
    const res = matchRequest(request, [centre("c", 0.05, { available: 5, confirmedAt: minsAgo(10) })], [donor("d")], now);
    for (const m of [...res.centres, ...res.donors]) {
      expect(m.rationale.length).toBeGreaterThan(1);
      expect(Math.round(m.rationale.reduce((s, r) => s + r.points, 0) * 10) / 10).toBe(m.score);
    }
  });

  it("is deterministic and breaks ties by distance then id", () => {
    const a = centre("a", 0.05, { available: 5, confirmedAt: minsAgo(10) });
    const b = centre("b", 0.05, { available: 5, confirmedAt: minsAgo(10) });
    const r1 = matchRequest(request, [b, a], [], now);
    const r2 = matchRequest(request, [a, b], [], now);
    expect(r1.centres.map((c) => c.id)).toEqual(["a", "b"]);
    expect(r2).toEqual(r1);
  });

  it("scores partial stock lower than sufficient stock and prefers exact group", () => {
    const enough = centre("enough", 0.05, { available: 5, confirmedAt: minsAgo(10) });
    const partial = centre("partial", 0.05, { available: 1, confirmedAt: minsAgo(10) });
    const res = matchRequest(request, [partial, enough], [], now);
    expect(res.centres[0].id).toBe("enough");
    const univ = centre("univ", 0.05, { g: "O-", available: 5, confirmedAt: minsAgo(10) });
    const exact = matchRequest(request, [univ, enough], [], now);
    expect(exact.centres[0].id).toBe("enough");
  });

  it("returns nothing, not fabricated candidates, when no source qualifies", () => {
    const res = matchRequest(request, [], [], now);
    expect(res.centres).toEqual([]);
    expect(res.donors).toEqual([]);
  });
});
