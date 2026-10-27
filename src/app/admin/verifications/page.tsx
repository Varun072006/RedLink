import type { Metadata } from "next";
import { ReviewCentre } from "@/components/admin/admin-controls";
import { Badge, EmptyState, Notice, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/lib/auth/session";
import { isServiceConfigured } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Verifications" };

const TONE = { pending: "warn", verified: "good", rejected: "bad", suspended: "bad" } as const;

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole(["admin"], "/admin/verifications");
  if (!isServiceConfigured()) return <Notice tone="warn" title="Service key missing">Set SUPABASE_SERVICE_ROLE_KEY to review facilities.</Notice>;
  const { status } = await searchParams;
  const filter = status && ["pending", "verified", "rejected", "suspended"].includes(status) ? status : "pending";
  const sb = createAdminSupabase();
  const { data: centres } = await sb
    .from("blood_centres")
    .select("id,name,kind,city,address,phone,license_ref,verification_status,verification_note,created_at,is_synthetic,centre_staff(profiles(display_name))")
    .eq("verification_status", filter)
    .order("created_at", { ascending: true })
    .limit(100);

  return (
    <div className="pb-10">
      <PageHeader title="Facility verification" intro="Check the registration reference against an official source before approving. Approval is recorded in the audit log." />
      <nav aria-label="Filter by status" className="mb-5 flex flex-wrap gap-2">
        {["pending", "verified", "rejected", "suspended"].map((s) => (
          <a key={s} href={`?status=${s}`} aria-current={filter === s ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize ${filter === s ? "border-forest bg-forest text-ivory" : "border-line bg-paper hover:bg-ivory-deep"}`}>
            {s}
          </a>
        ))}
      </nav>
      {!centres?.length ? (
        <EmptyState title={`No ${filter} facilities`} />
      ) : (
        <ul className="space-y-4">
          {centres.map((c) => {
            const owner = (c.centre_staff as unknown as { profiles: { display_name: string } | null }[] | null)?.[0]?.profiles?.display_name;
            return (
              <li key={c.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{c.name}</h2>
                  <div className="flex gap-2">
                    {c.is_synthetic && <Badge tone="warn">Synthetic</Badge>}
                    <Badge tone={TONE[c.verification_status as keyof typeof TONE]}>{c.verification_status}</Badge>
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Type</dt><dd>{c.kind === "hospital" ? "Hospital" : "Blood bank"}</dd></div>
                  <div><dt className="text-muted">Location</dt><dd>{c.address}, {c.city}</dd></div>
                  <div><dt className="text-muted">Phone</dt><dd>{c.phone}</dd></div>
                  <div><dt className="text-muted">Registration reference</dt><dd className="break-all font-mono">{c.license_ref}</dd></div>
                  <div><dt className="text-muted">Submitted by</dt><dd>{owner || "Unknown"}</dd></div>
                  <div><dt className="text-muted">Submitted</dt><dd>{new Date(c.created_at).toLocaleString()}</dd></div>
                  {c.verification_note && <div className="sm:col-span-2"><dt className="text-muted">Last note</dt><dd>{c.verification_note}</dd></div>}
                </dl>
                <div className="mt-4 border-t border-line pt-4">
                  <ReviewCentre id={c.id} status={c.verification_status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
