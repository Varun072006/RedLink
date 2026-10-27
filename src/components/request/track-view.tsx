"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Circle, Copy, Phone, RefreshCw, XCircle } from "lucide-react";
import { cancelRequestAction } from "@/actions/requests";
import type { TrackingView } from "@/lib/server/request-service";
import { COMPONENT_LABELS, type BloodComponent } from "@/lib/domain/blood";
import { Badge, Card, Notice } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const FLOW = ["submitted", "matching", "awaiting_response", "availability_confirmed", "fulfilled"] as const;
const FLOW_LABELS: Record<(typeof FLOW)[number], string> = {
  submitted: "Submitted",
  matching: "Searching",
  awaiting_response: "Awaiting responses",
  availability_confirmed: "Facility confirmed",
  fulfilled: "Fulfilled",
};

export function TrackView({ token, initial, isNew }: { token: string; initial: TrackingView; isNew: boolean }) {
  const [view, setView] = useState(initial);
  const [stale, setStale] = useState(false);
  const [pending, start] = useTransition();
  const reduce = useReducedMotion();
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setView(await res.json());
      setStale(false);
    } catch {
      setStale(true);
    }
  }, [token]);

  useEffect(() => {
    if (view.terminal) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => clearInterval(id);
  }, [view.terminal, refresh]);

  const idx = FLOW.indexOf(view.status as (typeof FLOW)[number]);
  const closedBad = view.terminal && view.status !== "fulfilled";

  return (
    <div className="space-y-5">
      {isNew && (
        <Notice tone="success" title="Request submitted">
          Save this page&apos;s link. It is the only way to track this request, and anyone with it can view or cancel the request.
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.origin + `/track/${token}`).then(() => toast.push("success", "Tracking link copied."));
              }}
            >
              <Copy size={14} aria-hidden /> Copy tracking link
            </Button>
          </div>
        </Notice>
      )}
      <Notice tone="warn" title="Contact the treating hospital now">
        Status here is a coordination aid. Only the hospital and its blood bank can confirm stock, compatibility and transfusion.
      </Notice>
      {stale && <Notice tone="warn">Could not refresh. Showing the last known status.</Notice>}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Reference</p>
            <p className="font-mono text-lg font-semibold">{view.reference}</p>
          </div>
          <Badge tone={view.status === "fulfilled" ? "good" : closedBad ? "bad" : view.status === "availability_confirmed" ? "good" : "info"}>{view.statusLabel}</Badge>
        </div>
        <p className="mt-3 text-sm">
          {view.units} unit(s) of <strong>{view.bloodGroup}</strong> {COMPONENT_LABELS[view.component as BloodComponent]?.toLowerCase()} for {view.facilityName}, {view.city}
        </p>
        {view.statusReason && <p className="mt-1 text-sm text-muted">{view.statusReason}</p>}
      </Card>

      {!closedBad && (
        <ol aria-label="Request progress" className="space-y-2">
          {FLOW.map((s, i) => {
            const done = idx > i || view.status === "fulfilled";
            const current = idx === i;
            return (
              <li key={s} aria-current={current ? "step" : undefined} className="flex items-center gap-3 text-sm">
                {done ? <CheckCircle2 size={18} className="text-forest" aria-label="Done" /> : <Circle size={18} className={current ? "text-oxblood" : "text-line"} aria-label={current ? "Current" : "Upcoming"} />}
                <span className={current ? "font-semibold" : done ? "" : "text-muted"}>{FLOW_LABELS[s]}</span>
              </li>
            );
          })}
        </ol>
      )}
      {closedBad && (
        <Notice tone="error" title={view.statusLabel}>
          This request is closed. If you still need blood, contact the hospital or submit a new request.
        </Notice>
      )}

      <AnimatePresence initial={false}>
        {view.confirmedCentres.length > 0 && (
          <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-forest/40">
              <h2 className="font-display text-lg font-semibold">Facility confirmed availability</h2>
              <p className="mt-1 text-sm text-muted">Call now to arrange collection. Confirmation holds units for this request only for a limited time.</p>
              <ul className="mt-3 space-y-3">
                {view.confirmedCentres.map((c) => (
                  <li key={c.name} className="text-sm">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-muted">{c.address}, {c.city}</p>
                    <a href={`tel:${c.phone}`} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-md bg-forest px-3 py-2 font-semibold text-ivory">
                      <Phone size={16} aria-hidden /> Call {c.phone}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!view.terminal && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Where things stand</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-muted">Facilities asked</dt><dd className="text-lg font-semibold">{view.centresAwaiting + view.confirmedCentres.length + view.centresUnavailable}</dd></div>
            <div><dt className="text-muted">Awaiting reply</dt><dd className="text-lg font-semibold">{view.centresAwaiting}</dd></div>
            <div><dt className="text-muted">Said unavailable</dt><dd className="text-lg font-semibold">{view.centresUnavailable}</dd></div>
            <div><dt className="text-muted">Willing donors</dt><dd className="text-lg font-semibold">{view.donorsWilling}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            Willing donors have said they may help. This is not confirmed stock or verified eligibility. Search radius: {view.searchRadiusKm} km, widened automatically if needed. Expires {new Date(view.expiresAt).toLocaleString()}.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw size={14} aria-hidden /> Refresh
        </Button>
        {!view.terminal && (
          <Button
            variant="danger"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                if (!window.confirm("Cancel this request? Any reserved units will be released.")) return;
                const res = await cancelRequestAction(token);
                if (res.ok) {
                  toast.push("success", res.message ?? "Cancelled.");
                  await refresh();
                } else toast.push("error", res.error);
              })
            }
          >
            <XCircle size={14} aria-hidden /> Cancel request
          </Button>
        )}
      </div>
    </div>
  );
}
