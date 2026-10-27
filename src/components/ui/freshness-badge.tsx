import { CheckCircle2, Clock, HelpCircle, TriangleAlert } from "lucide-react";
import { FRESHNESS_LABELS, formatAge, type FreshnessLevel } from "@/lib/domain/freshness";
import { Badge } from "./feedback";

const tone = { confirmed: "good", aging: "warn", stale: "bad", excluded: "bad", unconfirmed: "neutral" } as const;
const Icon = { confirmed: CheckCircle2, aging: Clock, stale: TriangleAlert, excluded: TriangleAlert, unconfirmed: HelpCircle } as const;

export function FreshnessBadge({ level, confirmedAt, now }: { level: FreshnessLevel; confirmedAt: string | null; now: Date }) {
  const I = Icon[level];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge tone={tone[level]}>
        <I size={12} aria-hidden /> {FRESHNESS_LABELS[level]}
      </Badge>
      <time className="text-xs text-muted" dateTime={confirmedAt ?? undefined}>
        {confirmedAt ? `Last confirmed ${formatAge(confirmedAt, now)}` : "Never confirmed"}
      </time>
    </span>
  );
}
