import type { Metadata } from "next";
import Link from "next/link";
import { CentreForm, RecordDonationForm } from "@/components/hospital/centre-forms";
import { Badge, Card, Notice, PageHeader } from "@/components/ui/feedback";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { getMyCentre } from "@/lib/data/centre";
import { freshnessPolicy } from "@/lib/env";
import { classifyFreshness } from "@/lib/domain/freshness";
import { createServerSupabase } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/realtime/live-refresh";

export const metadata: Metadata = { title: "Facility overview" };

export default async function HospitalDashboard() {
  const user = await requireRole(["staff"], "/hospital/dashboard");
  const centre = await getMyCentre();

  if (!centre) {
    return (
      <div className="pb-10">
        <PageHeader title="Register your facility" intro="An administrator verifies every facility before it can confirm stock or appear in search." />
        <div className="max-w-xl">
          <CentreForm mode="register" />
        </div>
      </div>
    );
  }

  if (centre.verification_status !== "verified") {
    const rejected = centre.verification_status === "rejected" || centre.verification_status === "suspended";
    return (
      <div className="pb-10">
        <LiveRefresh channel={`centre-status-${user.id}`} table="notifications" filter={`user_id=eq.${user.id}`} />
        <PageHeader title={centre.name} intro="Verification status" />
        <div className="max-w-xl space-y-4">
          <Notice tone={rejected ? "error" : "info"} title={centre.verification_status === "pending" ? "Awaiting administrator verification" : `Verification ${centre.verification_status}`}>
            {centre.verification_status === "pending"
              ? "Your details were submitted. You cannot manage inventory or confirm requests until an administrator verifies the facility."
              : (centre.verification_note ?? "Contact the platform administrators for details.")}
          </Notice>
          <Card>
            <h2 className="font-display text-lg font-semibold">Submitted details</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div><dt className="text-muted">Type</dt><dd>{centre.kind === "hospital" ? "Hospital" : "Blood bank"}</dd></div>
              <div><dt className="text-muted">Address</dt><dd>{centre.address}, {centre.city}</dd></div>
              <div><dt className="text-muted">Phone</dt><dd>{centre.phone}</dd></div>
              <div><dt className="text-muted">Registration reference</dt><dd>{centre.license_ref}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabase();
  const [{ data: inv }, { data: matches }] = await Promise.all([
    supabase.from("blood_inventory").select("units,reserved,last_confirmed_at").eq("centre_id", centre.id),
    supabase.from("request_matches").select("status").eq("centre_id", centre.id).in("status", ["notified", "confirmed"]),
  ]);
  const now = new Date();
  const policy = freshnessPolicy();
  const rows = inv ?? [];
  const stale = rows.filter((r) => r.units > 0 && classifyFreshness(r.last_confirmed_at, now, policy) !== "confirmed").length;
  const waiting = (matches ?? []).filter((m) => m.status === "notified").length;
  const reserved = (matches ?? []).filter((m) => m.status === "confirmed").length;
  const totalUnits = rows.reduce((s, r) => s + r.units, 0);

  const stats = [
    { label: "Awaiting your reply", value: waiting, href: "/hospital/requests", tone: waiting ? "bad" : "neutral" },
    { label: "Active reservations", value: reserved, href: "/hospital/requests", tone: "neutral" },
    { label: "Rows needing reconfirmation", value: stale, href: "/hospital/inventory", tone: stale ? "warn" : "good" },
    { label: "Units listed", value: totalUnits, href: "/hospital/inventory", tone: "neutral" },
  ] as const;

  return (
    <div className="pb-10">
      <LiveRefresh channel={`centre-${centre.id}`} table="request_matches" filter={`centre_id=eq.${centre.id}`} />
      <PageHeader
        title={centre.name}
        intro={`${centre.kind === "hospital" ? "Hospital" : "Blood bank"} · ${centre.city}`}
        actions={<LinkButton href="/hospital/inventory" variant="forest">Manage inventory</LinkButton>}
      />
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2"><Badge tone="good">Verified facility</Badge>{centre.is_synthetic && <Badge tone="warn">Synthetic demo</Badge>}</div>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="rounded-[var(--radius-card)] border border-line bg-paper p-4 hover:bg-ivory-deep">
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold">{s.value}</dd>
            </Link>
          ))}
        </dl>
        {stale > 0 && (
          <Notice tone="warn" title="Some stock is not recently confirmed">
            Searchers see these rows as stale. Recount and confirm them on the inventory page so people can rely on your figures.
          </Notice>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h2 className="font-display text-lg font-semibold">Record a verified donation</h2>
            <p className="mb-3 mt-1 text-sm text-muted">Adds to the donor&apos;s verified history and starts their donation interval.</p>
            <RecordDonationForm />
          </Card>
          {centre.staff_role === "owner" && (
            <Card>
              <h2 className="font-display text-lg font-semibold">Facility profile</h2>
              <p className="mb-3 mt-1 text-sm text-muted">Changing verified details is recorded in the audit log.</p>
              <CentreForm mode="edit" initial={{ name: centre.name, city: centre.city, address: centre.address, phone: centre.phone, lat: Number(centre.lat), lng: Number(centre.lng) }} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
