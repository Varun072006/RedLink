import { describe, expect, it } from "vitest";
import { searchAvailability, type SearchableCentre } from "@/lib/domain/availability";

const now = new Date("2026-01-01T12:00:00Z");
const ago = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
const centre = (id: string, dLat: number, confirmedMin: number | null, units = 5, reserved = 0): SearchableCentre => ({
  id, name: id, kind: "blood_bank", city: "X", address: "a", phone: "1", isSynthetic: false, lat: 12 + dLat, lng: 77,
  stock: [{ bloodGroup: "O+", component: "red_cells", units, reserved, confirmedAt: confirmedMin === null ? null : ago(confirmedMin) }],
});
const q = { bloodGroup: "O+" as const, component: "red_cells" as const, origin: { lat: 12, lng: 77 } };

describe("searchAvailability", () => {
  it("never labels old confirmations as confirmed and sorts by freshness by default", () => {
    const res = searchAvailability([centre("near-old", 0.01, 60 * 30), centre("far-new", 0.3, 10)], q, now);
    expect(res.map((r) => r.centre.id)).toEqual(["far-new", "near-old"]);
    expect(res[0].best).toBe("confirmed");
    expect(res[1].best).toBe("stale");
  });
  it("can sort nearest first", () => {
    const res = searchAvailability([centre("far-new", 0.3, 10), centre("near-old", 0.01, 60 * 30)], { ...q, sort: "distance" }, now);
    expect(res[0].centre.id).toBe("near-old");
    expect(res[0].direction).toBe("N");
  });
  it("ignores reserved units, empty rows and other components", () => {
    const res = searchAvailability([centre("all-reserved", 0, 5, 3, 3), centre("none", 0, 5, 0)], q, now);
    expect(res).toHaveLength(0);
    expect(searchAvailability([centre("a", 0, 5)], { ...q, component: "plasma" }, now)).toHaveLength(0);
  });
  it("flags unconfirmed stock and omits distance without an origin", () => {
    const res = searchAvailability([centre("a", 0, null)], { bloodGroup: "O+", component: "red_cells" }, now);
    expect(res[0].best).toBe("unconfirmed");
    expect(res[0].distanceKm).toBeNull();
  });
});
