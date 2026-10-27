"use server";

import { revalidatePath } from "next/cache";
import { dbFail, fail, type ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/auth/session";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function reviewCentreAction(centreId: string, decision: "approve" | "reject" | "suspend", note: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (!uuid(centreId) || !["approve", "reject", "suspend"].includes(decision)) return fail("Invalid request.");
  if (decision !== "approve" && note.trim().length < 3) return fail("Add a short reason for this decision.");
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("review_centre", { p_centre: centreId, p_decision: decision, p_note: note.trim().slice(0, 500) });
  if (error) return dbFail(error);
  revalidatePath("/admin/verifications");
  revalidatePath("/admin/dashboard");
  return { ok: true, message: "Decision recorded." };
}

export async function setAccountSuspensionAction(userId: string, suspend: boolean): Promise<ActionResult> {
  const admin = await requireRole(["admin"]);
  if (!uuid(userId) || userId === admin.id) return fail("You cannot change this account.");
  const sb = createAdminSupabase();
  const { data: target } = await sb.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return fail("Account not found.");
  if (target.role === "admin") return fail("Administrator accounts cannot be suspended here.");
  const { error } = await sb.from("profiles").update({ status: suspend ? "suspended" : "active" }).eq("id", userId);
  if (error) return fail("We could not update the account.");
  await sb.auth.admin.updateUserById(userId, { ban_duration: suspend ? "876000h" : "none" });
  await sb.rpc("log_audit", {
    p_actor: admin.id,
    p_action: suspend ? "account.suspended" : "account.reinstated",
    p_entity_type: "profile",
    p_entity_id: userId,
    p_meta: {},
  });
  revalidatePath("/admin/users");
  return { ok: true, message: suspend ? "Account suspended." : "Account reinstated." };
}

export async function resolveReportAction(reportId: string, status: "resolved" | "dismissed", closeRequest: boolean): Promise<ActionResult> {
  const admin = await requireRole(["admin"]);
  if (!uuid(reportId)) return fail("Invalid request.");
  const sb = createAdminSupabase();
  const { data: report } = await sb.from("abuse_reports").select("request_id,status").eq("id", reportId).maybeSingle();
  if (!report || report.status !== "open") return fail("This report is already handled.");
  if (closeRequest && report.request_id) {
    await sb.rpc("close_request", {
      p_request: report.request_id,
      p_status: "rejected",
      p_reason: "Rejected after administrator review.",
      p_actor: admin.id,
    });
  }
  await sb.from("abuse_reports").update({ status, resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq("id", reportId);
  await sb.rpc("log_audit", {
    p_actor: admin.id,
    p_action: `report.${status}`,
    p_entity_type: "abuse_report",
    p_entity_id: reportId,
    p_meta: { closed_request: closeRequest },
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "Report updated." };
}
