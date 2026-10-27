"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { recordDonationAction, registerCentreAction, updateCentreProfileAction } from "@/actions/hospital";
import { centreRegistrationSchema } from "@/lib/domain/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { LocationPicker } from "@/components/location/location-picker";
import { useToast } from "@/components/ui/toast";

type Values = z.infer<typeof centreRegistrationSchema>;

export function CentreForm({ mode, initial }: { mode: "register" | "edit"; initial?: Partial<Values> }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver((mode === "edit" ? centreRegistrationSchema.omit({ kind: true, licenseRef: true }) : centreRegistrationSchema) as typeof centreRegistrationSchema), defaultValues: { name: "", city: "", address: "", phone: "", licenseRef: "", kind: "blood_bank", ...initial } });
  const lat = useWatch({ control, name: "lat" });
  const lng = useWatch({ control, name: "lng" });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = mode === "register" ? await registerCentreAction(values) : await updateCentreProfileAction(values);
        if (!res.ok) {
          setError(res.error);
          Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setFieldError(k as keyof Values, { message: m }));
          return;
        }
        toast.push("success", res.message ?? "Saved.");
        router.refresh();
      })}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Facility name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
      </Field>
      {mode === "register" && (
        <>
          <Field label="Facility type" htmlFor="kind" error={errors.kind?.message}>
            <Select id="kind" {...register("kind")}>
              <option value="blood_bank">Blood bank</option>
              <option value="hospital">Hospital with a blood centre</option>
            </Select>
          </Field>
          <Field label="Licence or registration reference" htmlFor="licenseRef" hint="Shown only to administrators reviewing your application." error={errors.licenseRef?.message}>
            <Input id="licenseRef" aria-invalid={!!errors.licenseRef} {...register("licenseRef")} />
          </Field>
        </>
      )}
      <Field label="City" htmlFor="city" error={errors.city?.message}>
        <Input id="city" aria-invalid={!!errors.city} {...register("city")} />
      </Field>
      <Field label="Address" htmlFor="address" error={errors.address?.message}>
        <Input id="address" autoComplete="street-address" aria-invalid={!!errors.address} {...register("address")} />
      </Field>
      <Field label="Public phone number" htmlFor="phone" hint="Shown to people searching for blood." error={errors.phone?.message}>
        <Input id="phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium">Facility location</p>
        <LocationPicker
          idPrefix="centre"
          value={lat !== undefined && lng !== undefined ? { lat, lng } : null}
          onChange={(p) => {
            if (!p) return;
            setValue("lat", p.lat, { shouldValidate: true });
            setValue("lng", p.lng, { shouldValidate: true });
          }}
          error={errors.lat?.message}
        />
      </div>
      <Button type="submit" variant="forest" loading={isSubmitting}>
        {mode === "register" ? "Submit for verification" : "Save changes"}
      </Button>
    </form>
  );
}

export function RecordDonationForm() {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await recordDonationAction(code);
        setBusy(false);
        toast.push(res.ok ? "success" : "error", res.ok ? (res.message ?? "Recorded.") : res.error);
        if (res.ok) setCode("");
      }}
    >
      <div className="flex-1">
        <Field label="Donor code" htmlFor="donor-code" hint="Ask the donor for the 8-character code on their dashboard.">
          <Input id="donor-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} className="font-mono uppercase" autoComplete="off" />
        </Field>
      </div>
      <Button type="submit" variant="outline" loading={busy} disabled={code.trim().length !== 8}>
        Record verified donation
      </Button>
    </form>
  );
}
