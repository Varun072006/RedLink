"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { saveDonorProfileAction } from "@/actions/donor";
import { donorProfileSchema } from "@/lib/domain/schemas";
import { BLOOD_GROUPS } from "@/lib/domain/blood";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { LocationPicker, type CityOption } from "@/components/location/location-picker";
import { useToast } from "@/components/ui/toast";

type Values = z.infer<typeof donorProfileSchema>;

export function DonorProfileForm({ initial, cities }: { initial: Partial<Values> | null; cities: CityOption[] }) {
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
  } = useForm<Values>({
    resolver: zodResolver(donorProfileSchema),
    defaultValues: { city: "", optedIn: false, availability: "unavailable", lastDonationOn: "", ...initial },
  });
  const optedIn = useWatch({ control, name: "optedIn" });
  const lat = useWatch({ control, name: "lat" });
  const lng = useWatch({ control, name: "lng" });

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = await saveDonorProfileAction(values);
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
      <Notice tone="info" title="Self-reported information">
        Your blood group is what you tell us. Registering is not a medical eligibility check, and facility staff will screen you before any donation.
      </Notice>

      <Field label="Blood group" htmlFor="bloodGroup" error={errors.bloodGroup?.message}>
        <Select id="bloodGroup" aria-invalid={!!errors.bloodGroup} {...register("bloodGroup")} defaultValue={initial?.bloodGroup ?? ""}>
          <option value="" disabled>Select…</option>
          {BLOOD_GROUPS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </Select>
      </Field>

      <Field label="City" htmlFor="city" error={errors.city?.message}>
        <Input id="city" autoComplete="address-level2" aria-invalid={!!errors.city} {...register("city")} />
      </Field>

      <div>
        <p className="mb-1 text-sm font-medium">Approximate location</p>
        <p className="mb-2 text-xs text-muted">Rounded to about 1 km before it is saved. It is never shown to other users or in public search; requests only show an approximate distance.</p>
        <LocationPicker
          idPrefix="donor"
          cities={cities}
          value={lat !== undefined && lng !== undefined ? { lat, lng } : null}
          onChange={(p) => {
            if (!p) return;
            setValue("lat", p.lat, { shouldValidate: true });
            setValue("lng", p.lng, { shouldValidate: true });
          }}
          error={errors.lat?.message}
        />
      </div>

      <Field label="Last donation date (optional)" htmlFor="lastDonationOn" hint="Used to avoid contacting you too soon after a donation." error={errors.lastDonationOn?.message}>
        <Input id="lastDonationOn" type="date" max={new Date().toISOString().slice(0, 10)} {...register("lastDonationOn")} />
      </Field>

      <fieldset className="space-y-3 rounded-md border border-line bg-paper p-4">
        <legend className="px-1 text-sm font-semibold">Consent and availability</legend>
        <Checkbox
          id="optedIn"
          label="I agree to be contacted about nearby blood requests. I can withdraw this at any time."
          {...register("optedIn")}
        />
        <Field label="Availability" htmlFor="availability" error={errors.availability?.message}>
          <Select id="availability" disabled={!optedIn} {...register("availability")}>
            <option value="available">Available</option>
            <option value="paused">Paused</option>
            <option value="unavailable">Unavailable</option>
          </Select>
        </Field>
      </fieldset>

      <Button type="submit" variant="forest" loading={isSubmitting}>
        Save profile
      </Button>
    </form>
  );
}
