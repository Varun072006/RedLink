import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConfirmAllButton, InventoryForm } from "@/components/hospital/inventory-form";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { Badge, Card, Notice, PageHeader } from "@/components/ui/feedback";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { requireRole } from "@/lib/auth/session";
import { getMyCentre } from "@/lib/data/centre";
import { freshnessPolicy } from "@/lib/env";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABELS } from "@/lib/domain/blood";
import { classifyFreshness } from "@/lib/domain/freshness";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requireRole(["staff"], "/hospital/inventory");
  const centre = await getMyCentre();
  if (!centre || centre.verification_status !== "verified") redirect("/hospital/dashboard");

  const supabase = await createServerSupabase();
  const [{ data: inv }, { data: history }] = await Promise.all([
    supabase.from("blood_inventory").select("blood_group,component,units,reserved,last_confirmed_at").eq("centre_id", centre.id),
    supabase.from("inventory_adjustments").select("id,blood_group,component,kind,units_before,units_after,reserved_before,reserved_after,reason,created_at").eq("centre_id", centre.id).order("id", { ascending: false }).limit(15),
  ]);
  const now = new Date();
  const policy = freshnessPolicy();
  const byKey = new Map((inv ?? []).map((r) => [`${r.blood_group}|${r.component}`, r]));

  return (
    <div className="pb-10">
      <LiveRefresh channel={`inv-${centre.id}`} table="blood_inventory" filter={`centre_id=eq.${centre.id}`} />
      <PageHeader
        title="Inventory"
        intro="Counts are shown to the public with their confirmation time. Keep them current; stale figures are labelled automatically."
        actions={<ConfirmAllButton />}
      />
      <div className="space-y-5">
        {centre.is_synthetic && <Badge tone="warn">Synthetic demo facility</Badge>}
        <Card className="overflow-x-auto p-0 md:p-0">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Units by blood group and component, with confirmation status</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="p-3">Group</th>
                {COMPONENTS.map((c) => <th key={c} scope="col" className="p-3">{COMPONENT_LABELS[c]}</th>)}
              </tr>
            </thead>
            <tbody>
              {BLOOD_GROUPS.map((g) => (
                <tr key={g} className="border-b border-line last:border-0">
                  <th scope="row" className="p-3 font-semibold">{g}</th>
                  {COMPONENTS.map((c) => {
                    const r = byKey.get(`${g}|${c}`);
                    if (!r) return <td key={c} className="p-3 text-muted">–</td>;
                    const level = classifyFreshness(r.last_confirmed_at, now, policy);
                    return (
                      <td key={c} className="p-3 align-top">
                        <p className="font-semibold">{r.units - r.reserved} <span className="font-normal text-muted">free</span></p>
                        {r.reserved > 0 && <p className="text-xs text-muted">{r.reserved} reserved of {r.units}</p>}
                        <div className="mt-1"><FreshnessBadge level={level} confirmedAt={r.last_confirmed_at} now={now} /></div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-lg font-semibold">Update stock</h2>
          <InventoryForm />
        </Card>

        <section aria-labelledby="hist">
          <h2 id="hist" className="mb-3 font-display text-xl font-semibold">Recent changes</h2>
          {(history ?? []).length === 0 ? (
            <Notice>No changes recorded yet. Every update, reservation and release is logged here.</Notice>
          ) : (
            <Card className="overflow-x-auto p-0 md:p-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="p-3">When</th><th scope="col" className="p-3">Item</th><th scope="col" className="p-3">Change</th><th scope="col" className="p-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {(history ?? []).map((h) => (
                    <tr key={h.id} className="border-b border-line last:border-0">
                      <td className="p-3 whitespace-nowrap">{new Date(h.created_at).toLocaleString()}</td>
                      <td className="p-3">{h.blood_group} {COMPONENT_LABELS[h.component as keyof typeof COMPONENT_LABELS]}</td>
                      <td className="p-3"><Badge>{h.kind}</Badge> {h.units_before} → {h.units_after}{h.reserved_before !== h.reserved_after ? `, reserved ${h.reserved_before} → ${h.reserved_after}` : ""}</td>
                      <td className="p-3 text-muted">{h.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
