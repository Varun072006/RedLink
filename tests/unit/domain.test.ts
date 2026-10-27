import { describe, expect, it } from "vitest";
import { isPreliminarilyCompatible, supplyGroupsFor, BLOOD_GROUPS } from "@/lib/domain/blood";
import { approxDistanceLabel, compassDirection, haversineKm, roundCoordinate } from "@/lib/domain/distance";
import { classifyFreshness, freshnessPolicyFromEnv, DEFAULT_FRESHNESS_POLICY, formatAge } from "@/lib/domain/freshness";
import {
  canTransition,
  computeExpiry,
  isExpired,
  isTerminal,
  nextSearchRadius,
  REQUEST_STATUSES,
} from "@/lib/domain/request-state";
import { bloodRequestSchema, donorProfileSchema, inventoryDeltaSchema } from "@/lib/domain/schemas";
import { generateReference, generateTrackingToken, hashTrackingToken, isPlausibleToken } from "@/lib/domain/tracking";

const now = new Date("2026-01-01T12:00:00Z");
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

describe("blood compatibility (preliminary filter)", () => {
  it("O- red cells can be supplied to every group", () => {
    for (const g of BLOOD_GROUPS) expect(isPreliminarilyCompatible(g, "O-", "red_cells")).toBe(true);
  });
  it("Rh-negative recipients exclude Rh-positive red cells", () => {
    expect(supplyGroupsFor("A-", "red_cells").sort()).toEqual(["A-", "O-"]);
  });
  it("AB+ accepts all red-cell groups", () => {
    expect(supplyGroupsFor("AB+", "red_cells")).toHaveLength(8);
  });
  it("plasma follows reversed ABO", () => {
    expect(supplyGroupsFor("AB+", "plasma").every((g) => g.startsWith("AB"))).toBe(true);
    expect(isPreliminarilyCompatible("O+", "AB+", "plasma")).toBe(true);
    expect(isPreliminarilyCompatible("A+", "B+", "plasma")).toBe(false);
  });
});

describe("distance", () => {
  const blr = { lat: 12.9716, lng: 77.5946 };
  const mys = { lat: 12.2958, lng: 76.6394 };
  it("computes haversine distance within tolerance", () => {
    expect(haversineKm(blr, mys)).toBeGreaterThan(125);
    expect(haversineKm(blr, mys)).toBeLessThan(140);
    expect(haversineKm(blr, blr)).toBe(0);
  });
  it("gives compass direction", () => {
    expect(compassDirection(blr, mys)).toBe("SW");
    expect(compassDirection(mys, blr)).toBe("NE");
  });
  it("labels distances approximately and rounds coordinates", () => {
    expect(approxDistanceLabel(0.4)).toBe("under 1 km");
    expect(approxDistanceLabel(3.2)).toBe("about 3 km");
    expect(approxDistanceLabel(47)).toBe("about 45 km");
    expect(roundCoordinate(12.97163, 2)).toBe(12.97);
  });
});

describe("freshness policy", () => {
  it("classifies by age", () => {
    expect(classifyFreshness(minsAgo(30), now)).toBe("confirmed");
    expect(classifyFreshness(minsAgo(600), now)).toBe("aging");
    expect(classifyFreshness(minsAgo(60 * 30), now)).toBe("stale");
    expect(classifyFreshness(minsAgo(60 * 100), now)).toBe("excluded");
    expect(classifyFreshness(null, now)).toBe("unconfirmed");
  });
  it("treats future timestamps as unconfirmed", () => {
    expect(classifyFreshness(minsAgo(-600), now)).toBe("unconfirmed");
  });
  it("never reports stale stock as confirmed at the boundary", () => {
    expect(classifyFreshness(minsAgo(DEFAULT_FRESHNESS_POLICY.freshMinutes + 1), now)).not.toBe("confirmed");
  });
  it("falls back to defaults for inconsistent env policy", () => {
    expect(freshnessPolicyFromEnv({ FRESH_MINUTES: "5000", STALE_HOURS: "1", EXCLUDE_HOURS: "2" })).toEqual(
      DEFAULT_FRESHNESS_POLICY,
    );
    expect(freshnessPolicyFromEnv({ FRESH_MINUTES: "60" }).freshMinutes).toBe(60);
  });
  it("formats age", () => {
    expect(formatAge(minsAgo(5), now)).toBe("5 min ago");
    expect(formatAge(minsAgo(180), now)).toBe("3 h ago");
    expect(formatAge(null, now)).toBe("never confirmed");
  });
});

describe("request state machine", () => {
  it("allows the happy path", () => {
    const path = ["submitted", "matching", "awaiting_response", "availability_confirmed", "fulfilled"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("blocks leaving terminal states and skipping to fulfilled", () => {
    for (const s of REQUEST_STATUSES.filter(isTerminal))
      for (const t of REQUEST_STATUSES) expect(canTransition(s, t)).toBe(false);
    expect(canTransition("submitted", "fulfilled")).toBe(false);
    expect(canTransition("awaiting_response", "fulfilled")).toBe(false);
  });
  it("computes and checks expiry", () => {
    const exp = computeExpiry("critical", now);
    expect(exp.getTime() - now.getTime()).toBe(6 * 3_600_000);
    expect(isExpired(exp, now)).toBe(false);
    expect(isExpired(exp, new Date(exp.getTime() + 1))).toBe(true);
  });
  it("widens radius stepwise and stops", () => {
    expect(nextSearchRadius(10)).toBe(25);
    expect(nextSearchRadius(100)).toBeNull();
  });
});

describe("validation", () => {
  const valid = {
    bloodGroup: "O+",
    component: "red_cells",
    units: 2,
    facilityMode: "other",
    facilityName: "Synthetic Hospital",
    city: "Bengaluru",
    lat: 12.97,
    lng: 77.59,
    urgency: "urgent",
    contactPref: "phone",
    contactName: "Test Person",
    contactPhone: "+91 90000 00000",
    consent: true,
  };
  it("accepts a valid request", () => {
    expect(bloodRequestSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects missing consent, bad units and missing registered facility", () => {
    expect(bloodRequestSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(bloodRequestSchema.safeParse({ ...valid, units: 0 }).success).toBe(false);
    expect(bloodRequestSchema.safeParse({ ...valid, units: 1.5 }).success).toBe(false);
    expect(bloodRequestSchema.safeParse({ ...valid, facilityMode: "registered" }).success).toBe(false);
    expect(bloodRequestSchema.safeParse({ ...valid, contactPref: "email" }).success).toBe(false);
    expect(bloodRequestSchema.safeParse({ ...valid, bloodGroup: "Z+" }).success).toBe(false);
  });
  it("requires opt-in before a donor can be available", () => {
    const base = { bloodGroup: "A+", city: "X", lat: 1, lng: 1, optedIn: false, availability: "available" };
    expect(donorProfileSchema.safeParse(base).success).toBe(false);
    expect(donorProfileSchema.safeParse({ ...base, optedIn: true }).success).toBe(true);
  });
  it("rejects zero inventory delta", () => {
    expect(inventoryDeltaSchema.safeParse({ bloodGroup: "A+", component: "plasma", delta: 0, reason: "x" }).success).toBe(false);
  });
});

describe("tracking tokens", () => {
  it("generates unique, plausible, hashed tokens", () => {
    const a = generateTrackingToken();
    const b = generateTrackingToken();
    expect(a).not.toBe(b);
    expect(isPlausibleToken(a)).toBe(true);
    expect(isPlausibleToken("short")).toBe(false);
    expect(hashTrackingToken(a)).toHaveLength(64);
    expect(hashTrackingToken(a)).not.toContain(a);
    expect(generateReference()).toMatch(/^RL-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});
