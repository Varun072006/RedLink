"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Flag, PackageCheck, Undo2 } from "lucide-react";
import { centreRespondAction, flagRequestAction, fulfilRequestAction, releaseReservationAction } from "@/actions/hospital";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function MatchActions({ matchId, requestId, status }: { matchId: string; requestId: string; status: "notified" | "confirmed" | string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);

  function run(key: string, fn: () => Promise<ActionResult>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setWhich(key);
    start(async () => {
      const res = await fn();
      toast.push(res.ok ? "success" : "error", res.ok ? (res.message ?? "Done.") : res.error);
      router.refresh();
    });
  }

  const busy = (k: string) => pending && which === k;

  return (
    <div className="flex flex-wrap gap-2">
      {status === "notified" && (
        <>
          <Button
            variant="forest"
            size="sm"
            loading={busy("confirm")}
            disabled={pending}
            onClick={() => run("confirm", () => centreRespondAction(matchId, "confirm"), "Confirm you hold unreserved stock for this request? The units will be reserved.")}
          >
            <Check size={14} aria-hidden /> Confirm availability
          </Button>
          <Button variant="outline" size="sm" loading={busy("unavail")} disabled={pending} onClick={() => run("unavail", () => centreRespondAction(matchId, "unavailable"))}>
            <Ban size={14} aria-hidden /> Not available
          </Button>
        </>
      )}
      {status === "confirmed" && (
        <>
          <Button
            variant="forest"
            size="sm"
            loading={busy("fulfil")}
            disabled={pending}
            onClick={() => run("fulfil", () => fulfilRequestAction(matchId), "Mark as fulfilled? Reserved units will be deducted from stock.")}
          >
            <PackageCheck size={14} aria-hidden /> Mark fulfilled
          </Button>
          <Button variant="outline" size="sm" loading={busy("release")} disabled={pending} onClick={() => run("release", () => releaseReservationAction(matchId), "Release the reserved units?")}>
            <Undo2 size={14} aria-hidden /> Release reservation
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt("What looks suspicious about this request?");
          if (reason) run("flag", () => flagRequestAction(requestId, reason));
        }}
      >
        <Flag size={14} aria-hidden /> Report concern
      </Button>
    </div>
  );
}
