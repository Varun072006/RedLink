"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { respondToMatchAction, setAvailabilityAction } from "@/actions/donor";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const OPTIONS = [
  { v: "available", label: "Available", hint: "Receive nearby requests" },
  { v: "paused", label: "Paused", hint: "Temporarily off" },
  { v: "unavailable", label: "Unavailable", hint: "Not donating" },
] as const;

export function AvailabilityControl({ current, canBeAvailable }: { current: string; canBeAvailable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  return (
    <fieldset disabled={pending} className="space-y-2">
      <legend className="sr-only">Your availability</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => {
          const blocked = o.v === "available" && !canBeAvailable;
          return (
            <label
              key={o.v}
              className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm has-[:checked]:border-forest has-[:checked]:bg-[#e8f0ec] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest ${blocked ? "cursor-not-allowed opacity-55" : ""} border-line bg-paper`}
            >
              <input
                type="radio"
                name="availability"
                value={o.v}
                className="sr-only"
                checked={value === o.v}
                disabled={blocked}
                onChange={() => {
                  const prev = value;
                  setValue(o.v);
                  start(async () => {
                    const res = await setAvailabilityAction(o.v);
                    if (res.ok) {
                      toast.push("success", `Availability set to ${o.label.toLowerCase()}.`);
                      router.refresh();
                    } else {
                      setValue(prev);
                      toast.push("error", res.error);
                    }
                  });
                }}
              />
              <span className="font-semibold">{o.label}</span>
              <span className="text-xs text-muted">{o.hint}</span>
            </label>
          );
        })}
      </div>
      {!canBeAvailable && <p className="text-xs text-muted">Opt in to receiving requests in your profile to become available.</p>}
    </fieldset>
  );
}

export function RespondButtons({ matchId }: { matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  function respond(accept: boolean) {
    start(async () => {
      const res = await respondToMatchAction(matchId, accept);
      toast.push(res.ok ? "success" : "error", res.ok ? (res.message ?? "Done.") : res.error);
      router.refresh();
    });
  }
  return (
    <div className="flex gap-2">
      <Button variant="forest" size="sm" loading={pending} onClick={() => respond(true)}>
        <Check size={14} aria-hidden /> I am willing
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => respond(false)}>
        <X size={14} aria-hidden /> Decline
      </Button>
    </div>
  );
}
