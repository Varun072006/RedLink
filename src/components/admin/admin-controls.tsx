"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pause, UserCheck, UserX, X } from "lucide-react";
import { resolveReportAction, reviewCentreAction, setAccountSuspensionAction } from "@/actions/admin";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

function useRun() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const res = await fn();
      toast.push(res.ok ? "success" : "error", res.ok ? (res.message ?? "Done.") : res.error);
      router.refresh();
    });
  };
  return { run, pending };
}

export function ReviewCentre({ id, status }: { id: string; status: string }) {
  const { run, pending } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <Field label="Decision note" htmlFor={`note-${id}`} hint="Required to reject or suspend. Visible to the facility.">
        <Input id={`note-${id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {status !== "verified" && (
          <Button variant="forest" size="sm" disabled={pending} onClick={() => run(() => reviewCentreAction(id, "approve", note), "Approve this facility? It will be able to publish stock and receive requests.")}>
            <Check size={14} aria-hidden /> Approve
          </Button>
        )}
        {status === "pending" && (
          <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => reviewCentreAction(id, "reject", note))}>
            <X size={14} aria-hidden /> Reject
          </Button>
        )}
        {status === "verified" && (
          <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => reviewCentreAction(id, "suspend", note), "Suspend this facility? It will disappear from search.")}>
            <Pause size={14} aria-hidden /> Suspend
          </Button>
        )}
      </div>
    </div>
  );
}

export function SuspendButton({ id, suspended }: { id: string; suspended: boolean }) {
  const { run, pending } = useRun();
  return (
    <Button
      variant={suspended ? "outline" : "danger"}
      size="sm"
      disabled={pending}
      onClick={() => run(() => setAccountSuspensionAction(id, !suspended), suspended ? undefined : "Suspend this account? They will be signed out and blocked.")}
    >
      {suspended ? <UserCheck size={14} aria-hidden /> : <UserX size={14} aria-hidden />} {suspended ? "Reinstate" : "Suspend"}
    </Button>
  );
}

export function ReportActions({ id, hasRequest }: { id: string; hasRequest: boolean }) {
  const { run, pending } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      {hasRequest && (
        <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => resolveReportAction(id, "resolved", true), "Reject the request and resolve this report?")}>
          Reject request
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => resolveReportAction(id, "resolved", false))}>Mark resolved</Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => resolveReportAction(id, "dismissed", false))}>Dismiss</Button>
    </div>
  );
}
