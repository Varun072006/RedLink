import type { Metadata } from "next";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui/feedback";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };

const PREFIXES = ["", "centre", "inventory", "match", "request", "account", "donation", "report"];

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(["admin"], "/admin/audit-logs");
  const { q } = await searchParams;
  const prefix = PREFIXES.includes(q ?? "") ? (q ?? "") : "";
  const supabase = await createServerSupabase();
  let query = supabase.from("audit_logs").select("id,actor_id,action,entity_type,entity_id,metadata,created_at").order("id", { ascending: false }).limit(150);
  if (prefix) query = query.like("action", `${prefix}.%`);
  const { data, error } = await query;

  return (
    <div className="pb-10">
      <PageHeader title="Audit log" intro="Append-only history of sensitive actions. Entries cannot be edited or deleted." />
      <nav aria-label="Filter by area" className="mb-5 flex flex-wrap gap-2">
        {PREFIXES.map((p) => (
          <a key={p || "all"} href={p ? `?q=${p}` : "?"} aria-current={prefix === p ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${prefix === p ? "border-forest bg-forest text-ivory" : "border-line bg-paper hover:bg-ivory-deep"}`}>
            {p || "all"}
          </a>
        ))}
      </nav>
      {error && <Notice tone="error">Could not load the audit log.</Notice>}
      {!data?.length ? (
        <EmptyState title="No entries" />
      ) : (
        <Card className="overflow-x-auto p-0 md:p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="p-3">Time</th><th scope="col" className="p-3">Action</th><th scope="col" className="p-3">Entity</th><th scope="col" className="p-3">Actor</th><th scope="col" className="p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap p-3">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3 font-mono text-xs">{r.action}</td>
                  <td className="p-3">{r.entity_type}<span className="block break-all font-mono text-xs text-muted">{r.entity_id}</span></td>
                  <td className="p-3 font-mono text-xs">{r.actor_id ? r.actor_id.slice(0, 8) : "system"}</td>
                  <td className="max-w-xs break-words p-3 font-mono text-xs text-muted">{Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
