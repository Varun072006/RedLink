import type { Metadata } from "next";
import { ReportActions, SuspendButton } from "@/components/admin/admin-controls";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/lib/auth/session";
import { isServiceConfigured } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Accounts and reports" };

export default async function AdminUsersPage() {
  const admin = await requireRole(["admin"], "/admin/users");
  if (!isServiceConfigured()) return <Notice tone="warn" title="Service key missing">Set SUPABASE_SERVICE_ROLE_KEY to manage accounts.</Notice>;
  const sb = createAdminSupabase();
  const [{ data: reports }, { data: users }] = await Promise.all([
    sb.from("abuse_reports").select("id,reason,created_at,request_id,blood_requests(reference,status,facility_name,flagged),blood_centres(name)").eq("status", "open").order("created_at", { ascending: true }).limit(50),
    sb.from("profiles").select("id,role,status,display_name,created_at").order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <div className="pb-10">
      <PageHeader title="Accounts and reports" intro="Suspension blocks sign-in immediately and is recorded in the audit log." />
      <div className="space-y-8">
        <section aria-labelledby="reports">
          <h2 id="reports" className="mb-3 font-display text-xl font-semibold">Open reports <span className="text-base font-normal text-muted">({reports?.length ?? 0})</span></h2>
          {!reports?.length ? (
            <EmptyState title="No open reports" />
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => {
                const req = r.blood_requests as unknown as { reference: string; status: string; facility_name: string } | null;
                const centre = r.blood_centres as unknown as { name: string } | null;
                return (
                  <li key={r.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-4 text-sm">
                    <p className="font-semibold">{req ? `Request ${req.reference} (${req.status}) for ${req.facility_name}` : "Report"}</p>
                    <p className="mt-1">{r.reason}</p>
                    <p className="mt-1 text-xs text-muted">Reported by {centre?.name ?? "a user"} on {new Date(r.created_at).toLocaleString()}</p>
                    <div className="mt-3"><ReportActions id={r.id} hasRequest={!!r.request_id && !!req && !["fulfilled", "cancelled", "expired", "rejected", "unresolved"].includes(req.status)} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="accounts">
          <h2 id="accounts" className="mb-3 font-display text-xl font-semibold">Accounts</h2>
          <Card className="overflow-x-auto p-0 md:p-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="p-3">Name</th><th scope="col" className="p-3">Role</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Joined</th><th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="p-3">{u.display_name || <span className="text-muted">(no name)</span>}</td>
                    <td className="p-3 capitalize">{u.role}</td>
                    <td className="p-3"><Badge tone={u.status === "active" ? "good" : "bad"}>{u.status}</Badge></td>
                    <td className="p-3 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right">{u.role !== "admin" && u.id !== admin.id && <SuspendButton id={u.id} suspended={u.status === "suspended"} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>
    </div>
  );
}
