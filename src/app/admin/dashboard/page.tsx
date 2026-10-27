import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/lib/auth/session";
import { freshnessPolicy, isServiceConfigured } from "@/lib/env";
import { REQUEST_STATUSES } from "@/lib/domain/request-state";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminDashboard() {
  await requireRole(["admin"], "/admin/dashboard");
  if (!isServiceConfigured()) {
    return (
      <div className="pb-10">
        <PageHeader title="Administration" />
        <Notice tone="warn" title="Service key missing">Set SUPABASE_SERVICE_ROLE_KEY on the server to load platform metrics.</Notice>
      </div>
    );
  }
  const sb = createAdminSupabase();
  const policy = freshnessPolicy();
  const cutoff = new Date(new Date().getTime() - policy.staleHours * 3_600_000).toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact", head: true } as const;

  const [pending, verified, suspended, openReports, donors, availableDonors, staleCentres, ...statusCounts] = await Promise.all([
    count(sb.from("blood_centres").select("id", head).eq("verification_status", "pending")),
    count(sb.from("blood_centres").select("id", head).eq("verification_status", "verified")),
    count(sb.from("blood_centres").select("id", head).eq("verification_status", "suspended")),
    count(sb.from("abuse_reports").select("id", head).eq("status", "open")),
    count(sb.from("donor_profiles").select("user_id", head).eq("opted_in", true)),
    count(sb.from("donor_profiles").select("user_id", head).eq("opted_in", true).eq("availability", "available")),
    count(sb.from("blood_inventory").select("id", head).gt("units", 0).or(`last_confirmed_at.is.null,last_confirmed_at.lt.${cutoff}`)),
    ...REQUEST_STATUSES.map((s) => count(sb.from("blood_requests").select("id", head).eq("status", s))),
  ]);

  const tiles = [
    { label: "Facilities awaiting review", value: pending, href: "/admin/verifications", warn: pending > 0 },
    { label: "Verified facilities", value: verified, href: "/admin/verifications" },
    { label: "Suspended facilities", value: suspended, href: "/admin/verifications" },
    { label: "Open abuse reports", value: openReports, href: "/admin/users", warn: openReports > 0 },
    { label: "Opted-in donors", value: donors, href: "/admin/users" },
    { label: "Currently available donors", value: availableDonors, href: "/admin/users" },
    { label: `Stock rows not confirmed in ${policy.staleHours} h`, value: staleCentres, href: "/admin/verifications", warn: staleCentres > 0 },
  ];

  return (
    <div className="pb-10">
      <PageHeader title="Administration" intro="Aggregate platform metrics, read live from the database." />
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className={`rounded-[var(--radius-card)] border p-4 hover:bg-ivory-deep ${t.warn ? "border-warn/50 bg-[#f6ecd6]" : "border-line bg-paper"}`}>
              <dt className="text-xs text-muted">{t.label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold">{t.value}</dd>
            </Link>
          ))}
        </dl>
        <Card>
          <h2 className="font-display text-lg font-semibold">Requests by status</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 md:grid-cols-5">
            {REQUEST_STATUSES.map((s, i) => (
              <div key={s}>
                <dt className="text-muted">{s.replace(/_/g, " ")}</dt>
                <dd className="text-lg font-semibold">{statusCounts[i]}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
