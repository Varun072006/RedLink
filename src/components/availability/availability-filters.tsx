"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABELS } from "@/lib/domain/blood";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { LocationPicker, type CityOption, type PickedLocation } from "@/components/location/location-picker";

interface Props {
  group: string;
  component: string;
  location: PickedLocation | null;
  sort: string;
  view: string;
  cities: CityOption[];
}

export function AvailabilityFilters({ group, component, location, sort, view, cities }: Props) {
  const router = useRouter();
  const [g, setG] = useState(group);
  const [c, setC] = useState(component || "red_cells");
  const [loc, setLoc] = useState<PickedLocation | null>(location);
  const [s, setS] = useState(sort || "freshness");
  const [error, setError] = useState<string | undefined>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!g) return setError("Choose a blood group");
    setError(undefined);
    const p = new URLSearchParams({ g, c, s, view: view === "centres" ? "list" : view || "list" });
    if (loc) {
      p.set("lat", loc.lat.toFixed(4));
      p.set("lng", loc.lng.toFixed(4));
    }
    router.push(`/availability?${p.toString()}`);
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Search blood availability" className="space-y-4 rounded-[var(--radius-card)] border border-line bg-paper p-4 md:p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Blood group needed" htmlFor="f-group" error={error}>
          <Select id="f-group" value={g} onChange={(e) => setG(e.target.value)} aria-invalid={!!error}>
            <option value="">Select…</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
        </Field>
        <Field label="Component" htmlFor="f-comp">
          <Select id="f-comp" value={c} onChange={(e) => setC(e.target.value)}>
            {COMPONENTS.map((k) => (
              <option key={k} value={k}>{COMPONENT_LABELS[k]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sort by" htmlFor="f-sort">
          <Select id="f-sort" value={s} onChange={(e) => setS(e.target.value)}>
            <option value="freshness">Freshest confirmation</option>
            <option value="distance" disabled={!loc}>Nearest first{loc ? "" : " (set a location)"}</option>
          </Select>
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Your location <span className="font-normal text-muted">(optional, used for approximate distance)</span></p>
        <LocationPicker idPrefix="avail" value={loc} onChange={setLoc} cities={cities} />
      </div>
      <Button type="submit" variant="forest">
        <Search size={16} aria-hidden /> Search availability
      </Button>
    </form>
  );
}
