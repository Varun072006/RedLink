import type { Metadata } from "next";
import Link from "next/link";
import { Map as MapIcon, List, Building2 } from "lucide-react";
import { AvailabilityFilters } from "@/components/availability/availability-filters";
import { MapLoader } from "@/components/availability/map-loader";
import { ResultCard } from "@/components/availability/result-card";
import { Badge, DemoBanner, EmptyState, Notice, PageHeader } from "@/components/ui/feedback";
import { searchAvailability, type SearchableCentre } from "@/lib/domain/availability";
import { COMPONENT_LABELS, isBloodGroup, isComponent, type BloodComponent } from "@/lib/domain/blood";
import { loadCentres } from "@/lib/data/centres";
import { freshnessPolicy } from "@/lib/env";

export const metadata: Metadata = { title: "Find blood" };

type Params = { g?: string; c?: string; lat?: string; lng?: string; s?: string; view?: string };

function cityOptions(centres: SearchableCentre[]) {
  const by = new Map<string, { lat: number; lng: number; n: number }>();
  for (const c of centres) {
    const cur = by.get(c.city) ?? { lat: 0, lng: 0, n: 0 };
    by.set(c.city, { lat: cur.lat + c.lat, lng: cur.lng + c.lng, n: cur.n + 1 });
  }
  return [...by.entries()].map(([city, v]) => ({ city, lat: v.lat / v.n, lng: v.lng / v.n })).sort((a, b) => a.city.localeCompare(b.city));
}

function tabHref(params: Params, view: string) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, view })) if (v) p.set(k, v);
  return `/availability?${p.toString()}`;
}

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const now = new Date();
  const { centres, mode, failed } = await loadCentres();
  const group = params.g && isBloodGroup(params.g) ? params.g : null;
  const component: BloodComponent = params.c && isComponent(params.c) ? params.c : "red_cells";
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const origin = params.lat && params.lng && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  const view = params.view === "map" || params.view === "centres" ? params.view : "list";
  const sort = params.s === "distance" && origin ? "distance" : "freshness";

  const results = group ? searchAvailability(centres, { bloodGroup: group, component, origin, sort }, now, freshnessPolicy()) : [];
  const anyConfirmed = results.some((r) => r.best === "confirmed");

  return (
    <div className="pb-10">
      <PageHeader
        title="Find blood"
        intro="Search verified blood centres. Every figure shows when staff last confirmed it. Willing donors are never counted as stock."
      />
      <div className="space-y-4">
        {mode === "demo" && <DemoBanner />}
        {failed && <Notice tone="error" title="We could not load availability">The data service did not respond. Try again shortly, or contact a facility directly.</Notice>}
        <Notice tone="warn" title="In an emergency">
          Contact the treating hospital or an authorized blood bank immediately. Listed units can change at any moment, and clinicians decide compatibility.
        </Notice>

        <AvailabilityFilters
          key={`${params.g}-${params.c}-${params.lat}-${params.lng}-${params.s}`}
          group={group ?? ""}
          component={component}
          location={origin ? { ...origin, label: "Chosen location" } : null}
          sort={sort}
          view={view}
          cities={cityOptions(centres)}
        />

        <nav aria-label="Result view" className="flex gap-1 border-b border-line">
          {[
            { v: "list", label: "List", icon: List },
            { v: "map", label: "Map", icon: MapIcon },
            { v: "centres", label: "All centres", icon: Building2 },
          ].map(({ v, label, icon: I }) => (
            <Link
              key={v}
              href={tabHref(params, v)}
              aria-current={view === v ? "page" : undefined}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${view === v ? "border-oxblood text-oxblood" : "border-transparent text-muted hover:text-charcoal"}`}
            >
              <I size={16} aria-hidden /> {label}
            </Link>
          ))}
        </nav>

        {view === "centres" ? (
          centres.length === 0 ? (
            <EmptyState title="No verified centres yet">Facilities appear here after an administrator verifies them.</EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {centres.map((c) => (
                <li key={c.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <div className="flex gap-2">
                      {c.isSynthetic && <Badge tone="warn">Synthetic demo</Badge>}
                      <Badge tone="good">Verified</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted">{c.kind === "hospital" ? "Hospital" : "Blood bank"} · {c.city}</p>
                  <p className="mt-1 text-sm">{c.address}</p>
                  <a href={`tel:${c.phone}`} className="mt-2 inline-block text-sm font-semibold text-forest underline underline-offset-4">{c.phone}</a>
                </li>
              ))}
            </ul>
          )
        ) : !group ? (
          <EmptyState title="Choose a blood group to search">
            Results list facilities that report unreserved units of a preliminarily compatible group, ranked by how recently they confirmed stock.
          </EmptyState>
        ) : results.length === 0 ? (
          <EmptyState
            title="No listed stock found"
            action={<Link href="/request-blood" className="rounded-md bg-oxblood px-4 py-2.5 text-sm font-semibold text-ivory hover:bg-oxblood-ink">Submit an emergency request</Link>}
          >
            No verified facility lists {COMPONENT_LABELS[component].toLowerCase()} for {group} or a preliminarily compatible group. That does not mean none exists. Submitting a request widens the search to donors and facilities.
          </EmptyState>
        ) : (
          <>
            {!anyConfirmed && (
              <Notice tone="warn" title="No recently confirmed stock">
                Matching stock exists on record but none was confirmed within the freshness window. Treat these as leads and call to verify.
              </Notice>
            )}
            <p className="text-sm text-muted" aria-live="polite">
              {results.length} facilit{results.length === 1 ? "y" : "ies"} list{results.length === 1 ? "s" : ""} {COMPONENT_LABELS[component].toLowerCase()} for {group} or a preliminarily compatible group.
            </p>
            {view === "map" ? (
              <MapLoader
                origin={origin}
                points={results.map((r) => ({
                  id: r.centre.id,
                  name: r.centre.name,
                  lat: r.centre.lat,
                  lng: r.centre.lng,
                  level: r.best,
                  summary: `${r.lines[0].available} unit(s) ${r.lines[0].bloodGroup}, ${r.best === "confirmed" ? "recently confirmed" : "not recently confirmed"}`,
                  phone: r.centre.phone,
                  synthetic: r.centre.isSynthetic,
                }))}
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {results.map((r) => (
                  <ResultCard key={r.centre.id} result={r} now={now} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
