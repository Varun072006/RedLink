import { Building2, Droplets, Navigation, Phone } from "lucide-react";
import type { AvailabilityResult } from "@/lib/domain/availability";
import { approxDistanceLabel } from "@/lib/domain/distance";
import { Badge } from "@/components/ui/feedback";
import { FreshnessBadge } from "@/components/ui/freshness-badge";

export function ResultCard({ result, now }: { result: AvailabilityResult; now: Date }) {
  const { centre, lines, best } = result;
  const needsCall = best !== "confirmed";
  return (
    <li className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold">
            <Building2 size={16} strokeWidth={1.75} className="shrink-0 text-forest" aria-hidden />
            <span className="break-words">{centre.name}</span>
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            {centre.city} · {centre.kind === "hospital" ? "Hospital" : "Blood bank"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {centre.isSynthetic && <Badge tone="warn">Synthetic demo</Badge>}
          <Badge tone="good">Verified facility</Badge>
        </div>
      </div>

      {result.distanceKm !== null && (
        <p className="mt-2 flex items-center gap-1.5 text-sm">
          <Navigation size={14} aria-hidden className="text-muted" />
          {approxDistanceLabel(result.distanceKm)} {result.direction}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {lines.slice(0, 3).map((l) => (
          <li key={l.bloodGroup} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 first:border-0 first:pt-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Droplets size={14} aria-hidden className="text-oxblood" /> {l.bloodGroup}
              <span className="font-normal text-muted">{l.exactGroup ? "exact group" : "preliminary match"}</span>
            </span>
            <span className="text-sm">{l.available} unit{l.available === 1 ? "" : "s"} listed</span>
            <FreshnessBadge level={l.freshness} confirmedAt={l.confirmedAt} now={now} />
          </li>
        ))}
      </ul>

      {needsCall && (
        <p className="mt-3 text-xs text-muted">Stock was not confirmed recently. Call to verify before travelling.</p>
      )}
      <a
        href={`tel:${centre.phone}`}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-charcoal/30 px-3 py-2 text-sm font-semibold hover:bg-ivory-deep"
      >
        <Phone size={16} aria-hidden /> Call {centre.phone}
      </a>
    </li>
  );
}
