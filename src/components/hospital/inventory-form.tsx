"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { adjustInventoryAction, confirmInventoryAction, setInventoryAction } from "@/actions/hospital";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABELS } from "@/lib/domain/blood";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function InventoryForm({ defaults }: { defaults?: { bloodGroup?: string; component?: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"set" | "delta">("set");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const base = { bloodGroup: f.get("bloodGroup"), component: f.get("component"), reason: String(f.get("reason") ?? "") };
    const n = f.get("amount") === "" ? NaN : Number(f.get("amount"));
    setBusy(true);
    setErrors({});
    const res = mode === "set" ? await setInventoryAction({ ...base, units: n }) : await adjustInventoryAction({ ...base, delta: n });
    setBusy(false);
    if (res.ok) {
      toast.push("success", res.message ?? "Saved.");
      router.refresh();
    } else {
      setErrors(res.fieldErrors ?? {});
      toast.push("error", res.error);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <fieldset className="flex gap-4 text-sm">
        <legend className="sr-only">Update type</legend>
        <label className="flex items-center gap-2"><input type="radio" className="accent-forest" checked={mode === "set"} onChange={() => setMode("set")} /> Set counted total</label>
        <label className="flex items-center gap-2"><input type="radio" className="accent-forest" checked={mode === "delta"} onChange={() => setMode("delta")} /> Adjust by amount</label>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Blood group" htmlFor="inv-group" error={errors.bloodGroup}>
          <Select id="inv-group" name="bloodGroup" defaultValue={defaults?.bloodGroup ?? "O+"}>
            {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Component" htmlFor="inv-comp" error={errors.component}>
          <Select id="inv-comp" name="component" defaultValue={defaults?.component ?? "red_cells"}>
            {COMPONENTS.map((c) => <option key={c} value={c}>{COMPONENT_LABELS[c]}</option>)}
          </Select>
        </Field>
        <Field
          label={mode === "set" ? "Units on the shelf (physical count)" : "Change in units (negative to remove)"}
          htmlFor="inv-amount"
          hint={mode === "set" ? "Saving a count also marks it as confirmed now." : "Adjustments do not refresh the confirmation time. Recount to confirm."}
          error={errors.units ?? errors.delta}
        >
          <Input id="inv-amount" name="amount" type="number" inputMode="numeric" step={1} required />
        </Field>
        <Field label={mode === "set" ? "Note (optional)" : "Reason"} htmlFor="inv-reason" error={errors.reason}>
          <Input id="inv-reason" name="reason" maxLength={200} required={mode === "delta"} />
        </Field>
      </div>
      <Button type="submit" variant="forest" loading={busy}>
        {mode === "set" ? "Save count" : "Record adjustment"}
      </Button>
    </form>
  );
}

export function ConfirmAllButton() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      loading={busy}
      onClick={async () => {
        if (!window.confirm("Confirm that all listed counts are accurate right now?")) return;
        setBusy(true);
        const res = await confirmInventoryAction();
        setBusy(false);
        toast.push(res.ok ? "success" : "error", res.ok ? (res.message ?? "Confirmed.") : res.error);
        router.refresh();
      }}
    >
      <CheckCheck size={16} aria-hidden /> Confirm all as current
    </Button>
  );
}
