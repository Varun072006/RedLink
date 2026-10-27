import type { SearchableCentre, StockRow } from "@/lib/domain/availability";
import type { BloodGroup } from "@/lib/domain/blood";

const MIN = 60_000;

const groups: [BloodGroup, number][] = [
  ["O+", 8],
  ["O-", 2],
  ["A+", 6],
  ["B+", 4],
  ["AB+", 1],
];

function stockFor(ageMinutes: number, now: Date): StockRow[] {
  const confirmedAt = new Date(now.getTime() - ageMinutes * MIN).toISOString();
  return groups.flatMap(([bloodGroup, units]) =>
    (["red_cells", "plasma"] as const).map((component) => ({ bloodGroup, component, units, reserved: 0, confirmedAt })),
  );
}

/** Synthetic records used only when no database is configured. Never real facilities or stock. */
export function demoCentres(now = new Date()): SearchableCentre[] {
  const base = { isSynthetic: true as const };
  return [
    { ...base, id: "demo-1", name: "SYNTHETIC Demo Blood Bank A", kind: "blood_bank", city: "Bengaluru", address: "Demo address 1 (not real)", phone: "0000000001", lat: 12.9716, lng: 77.5946, stock: stockFor(25, now) },
    { ...base, id: "demo-2", name: "SYNTHETIC Demo Hospital B", kind: "hospital", city: "Bengaluru", address: "Demo address 2 (not real)", phone: "0000000002", lat: 12.9352, lng: 77.6245, stock: stockFor(9 * 60, now) },
    { ...base, id: "demo-3", name: "SYNTHETIC Demo Blood Bank C", kind: "blood_bank", city: "Bengaluru", address: "Demo address 3 (not real)", phone: "0000000003", lat: 13.0359, lng: 77.597, stock: stockFor(40 * 60, now) },
    { ...base, id: "demo-4", name: "SYNTHETIC Demo Hospital D", kind: "hospital", city: "Mysuru", address: "Demo address 4 (not real)", phone: "0000000004", lat: 12.2958, lng: 76.6394, stock: stockFor(2 * 60, now) },
    { ...base, id: "demo-5", name: "SYNTHETIC Demo Blood Bank E", kind: "blood_bank", city: "Chennai", address: "Demo address 5 (not real)", phone: "0000000005", lat: 13.0827, lng: 80.2707, stock: stockFor(120 * 60, now) },
  ];
}
