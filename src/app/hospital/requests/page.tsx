import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Phone } from "lucide-react";
import { MatchActions } from "@/components/hospital/match-actions";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Badge, EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/lib/auth/session";
import { getMyCentre } from "@/lib/data/centre";
import { COMPONENT_LABELS, URGENCY_LABELS, type BloodComponent, type Urgency } from "@/lib/domain/blood";
import { formatAge } from "@/lib/domain/freshness";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Requests" };

interface Row {
  id: string;
  status: string;
  supply_group: string;
  score: number;
  distance_km: number;
  rationale: { factor: string; points: number; detail: string }[];
  expires_at: string;
  blood_requests: {
    id: string;
    reference: string;
    blood_group: string;
    component: BloodComponent;
    units: number;
    urgency: Urgency;
    status: string;
    facility_name: string;
    city: string;
    location_detail: string | null;
    contact_name: string;
    contact_phone: string;
    contact_pref: string;
    notes: string | null;
    flagged: boolean;
    created_at: string;
    expires_at: string;
  } | null;
}

const CLOSED = ["fulfilled", "cancelled", "expired", "rejected", "unresolved"];

interface StockRow {
  units: number;
  reserved: number;
  last_confirmed_at: string | null;
}
interface Ctx {
  stock: Map<string, StockRow>;
  now: Date;
  live: Set<string>;
}

function RequestCard({ r, ctx }: { r: Row; ctx: Ctx }) {
  const q = r.blood_requests!;
  const s = ctx.stock.get(`${r.supply_group}|${q.component}`);
  return (
    <li className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{q.units} unit(s) · {q.blood_group} · {COMPONENT_LABELS[q.component]}</p>
          <p className="font-mono text-xs text-muted">{q.reference}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={q.urgency === "critical" ? "bad" : "warn"}>{URGENCY_LABELS[q.urgency]}</Badge>
          {q.flagged && <Badge tone="bad">Flagged</Badge>}
          <Badge tone={r.status === "confirmed" ? "good" : "neutral"}>{r.status}</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm">For {q.facility_name}, {q.city}{q.location_detail ? ` (${q.location_detail})` : ""}</p>
      <p className="mt-1 text-sm">
        Contact: {q.contact_name}{" "}
        <a href={`tel:${q.contact_phone}`} className="inline-flex items-center gap-1 font-semibold text-forest underline underline-offset-4"><Phone size={14} aria-hidden />{q.contact_phone}</a>{" "}
        <span className="text-muted">(prefers {q.contact_pref})</span>
      </p>
      {q.notes && <p className="mt-1 text-sm text-muted">Note: {q.notes}</p>}
      <p className="mt-2 text-sm">
        Matched on <strong>{r.supply_group}</strong>. Your unreserved stock: <strong>{s ? s.units - s.reserved : 0}</strong>
        {s && <span className="text-muted"> (confirmed {formatAge(s.last_confirmed_at, ctx.now)})</span>}
      </p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted underline underline-offset-4">Why this matched ({Number(r.score)} points, about {Number(r.distance_km)} km)</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {r.rationale.map((x) => <li key={x.factor}>{x.detail} (+{x.points})</li>)}
        </ul>
        <p className="mt-2 text-xs text-muted">Preliminary screening only. Clinical compatibility is decided by your qualified staff.</p>
      </details>
      {ctx.live.has(r.id) && (
        <div className="mt-3">
          <MatchActions matchId={r.id} requestId={q.id} status={r.status} />
        </div>
      )}
    </li>
  );
}

function Section({ id, title, items, empty, ctx }: { id: string; title: string; items: Row[]; empty: string; ctx: Ctx }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 font-display text-xl font-semibold">{title} <span className="text-base font-normal text-muted">({items.length})</span></h2>
      {items.length === 0 ? <EmptyState title={empty} /> : <ul className="space-y-3">{items.map((r) => <RequestCard key={r.id} r={r} ctx={ctx} />)}</ul>}
    </section>
  );
}

export default async function HospitalRequests() {
  await requireRole(["staff"], "/hospital/requests");
  const centre = await getMyCentre();
  if (!centre || centre.verification_status !== "verified") redirect("/hospital/dashboard");

  const supabase = await createServerSupabase();
  const [{ data }, { data: inv }] = await Promise.all([
    supabase
      .from("request_matches")
      .select("id,status,supply_group,score,distance_km,rationale,expires_at,blood_requests(id,reference,blood_group,component,units,urgency,status,facility_name,city,location_detail,contact_name,contact_phone,contact_pref,notes,flagged,created_at,expires_at)")
      .eq("centre_id", centre.id)
      .order("notified_at", { ascending: false })
      .limit(60)
      .returns<Row[]>(),
    supabase.from("blood_inventory").select("blood_group,component,units,reserved,last_confirmed_at").eq("centre_id", centre.id),
  ]);
  const now = new Date();
  const rows = (data ?? []).filter((r) => r.blood_requests);
  const stock = new Map((inv ?? []).map((i) => [`${i.blood_group}|${i.component}`, i]));
  const live = (r: Row) => !CLOSED.includes(r.blood_requests!.status) && new Date(r.blood_requests!.expires_at) > now;
  const waiting = rows.filter((r) => r.status === "notified" && live(r));
  const reserved = rows.filter((r) => r.status === "confirmed" && live(r));
  const rest = rows.filter((r) => !waiting.includes(r) && !reserved.includes(r));
  const ctx: Ctx = { stock, now, live: new Set(rows.filter(live).map((r) => r.id)) };

  return (
    <div className="pb-10">
      <LiveRefresh channel={`reqs-${centre.id}`} table="request_matches" filter={`centre_id=eq.${centre.id}`} />
      <PageHeader title="Requests" intro="Confirm only stock you can hold. Confirming reserves the units so they cannot be promised twice." />
      <div className="space-y-8">
        <Section ctx={ctx} id="waiting" title="Needs your reply" items={waiting} empty="Nothing waiting" />
        <Section ctx={ctx} id="reserved" title="Reserved" items={reserved} empty="No active reservations" />
        {rest.length > 0 && <Section ctx={ctx} id="closed" title="Earlier" items={rest} empty="" />}
      </div>
    </div>
  );
}
