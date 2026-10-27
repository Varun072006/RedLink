"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Send } from "lucide-react";
import { createRequestAction } from "@/actions/requests";
import { bloodRequestSchema, type BloodRequestInput } from "@/lib/domain/schemas";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABELS, URGENCIES, URGENCY_LABELS } from "@/lib/domain/blood";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { LocationPicker, type CityOption } from "@/components/location/location-picker";

export interface RegisteredCentre {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
}

const STEPS = [
  { title: "Blood requirement", fields: ["bloodGroup", "component", "units"] },
  { title: "Destination", fields: ["facilityMode", "centreId", "facilityName", "city", "locationDetail", "lat", "lng"] },
  { title: "Urgency and contact", fields: ["urgency", "contactPref", "contactName", "contactPhone", "contactEmail", "notes", "consent"] },
  { title: "Review and submit", fields: [] },
] as const;

type Values = BloodRequestInput;

export function RequestWizard({ centres, cities, enabled }: { centres: RegisteredCentre[]; cities: CityOption[]; enabled: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    control,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(bloodRequestSchema),
    mode: "onChange",
    defaultValues: {
      units: 1,
      facilityMode: centres.length ? "registered" : "other",
      urgency: "urgent",
      contactPref: "phone",
      facilityName: "",
      city: "",
      locationDetail: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      notes: "",
    } as Partial<Values>,
  });

  const mode = useWatch({ control, name: "facilityMode" });
  const lat = useWatch({ control, name: "lat" });
  const lng = useWatch({ control, name: "lng" });
  const err = (k: FieldPath<Values>) => (errors as Record<string, { message?: string } | undefined>)[k]?.message;

  async function next() {
    const ok = await trigger(STEPS[step].fields as unknown as FieldPath<Values>[]);
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit(values: Values) {
    setServerError(null);
    const res = await createRequestAction(values, submissionId);
    if (!res.ok) {
      setServerError(res.error);
      if (res.fieldErrors) {
        Object.entries(res.fieldErrors).forEach(([k, m]) => setError(k as FieldPath<Values>, { message: m }));
        setStep(0);
      } else {
        setSubmissionId(crypto.randomUUID());
      }
      return;
    }
    router.push(`/track/${res.data!.token}?new=1`);
  }

  const v = getValues();
  const slide = reduce ? { initial: false as const } : { initial: { opacity: 0, x: 12 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0 } };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Emergency blood request" className="space-y-5">
      <ol className="flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex-1" aria-current={i === step ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-oxblood" : "bg-line"}`} />
            <p className={`mt-1.5 hidden text-xs sm:block ${i === step ? "font-semibold text-charcoal" : "text-muted"}`}>{s.title}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm font-semibold sm:hidden">Step {step + 1} of 4: {STEPS[step].title}</p>

      {!enabled && (
        <Notice tone="warn" title="Submissions are not available">
          This deployment has no backend configured, so requests cannot be saved. In an emergency contact the treating facility directly.
        </Notice>
      )}
      {serverError && <Notice tone="error">{serverError}</Notice>}

      <AnimatePresence mode="wait">
        <motion.div key={step} {...slide} transition={{ duration: 0.16 }} className="space-y-4">
          {step === 0 && (
            <>
              <Field label="Blood group needed" htmlFor="bloodGroup" error={err("bloodGroup")}>
                <Select id="bloodGroup" aria-invalid={!!err("bloodGroup")} {...register("bloodGroup")} defaultValue="">
                  <option value="" disabled>Select…</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Component" htmlFor="component" error={err("component")}>
                <Select id="component" aria-invalid={!!err("component")} {...register("component")} defaultValue="">
                  <option value="" disabled>Select…</option>
                  {COMPONENTS.map((c) => (
                    <option key={c} value={c}>{COMPONENT_LABELS[c]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Units required" htmlFor="units" hint="Up to 20 units per request." error={err("units")}>
                <Input id="units" type="number" inputMode="numeric" min={1} max={20} aria-invalid={!!err("units")} {...register("units", { valueAsNumber: true })} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Treating facility</legend>
                {centres.length > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" value="registered" className="accent-forest" {...register("facilityMode")} /> Choose a verified facility
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="other" className="accent-forest" {...register("facilityMode")} /> Another hospital or location
                </label>
              </fieldset>

              {mode === "registered" ? (
                <Field label="Verified facility" htmlFor="centreId" error={err("centreId")}>
                  <Select
                    id="centreId"
                    aria-invalid={!!err("centreId")}
                    {...register("centreId", {
                      onChange: (e) => {
                        const c = centres.find((x) => x.id === e.target.value);
                        if (c) {
                          setValue("facilityName", c.name);
                          setValue("city", c.city);
                          setValue("lat", c.lat, { shouldValidate: true });
                          setValue("lng", c.lng, { shouldValidate: true });
                        }
                      },
                    })}
                    defaultValue=""
                  >
                    <option value="" disabled>Select…</option>
                    {centres.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} — {c.city}</option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <>
                  <Field label="Hospital or facility name" htmlFor="facilityName" error={err("facilityName")}>
                    <Input id="facilityName" aria-invalid={!!err("facilityName")} {...register("facilityName")} />
                  </Field>
                  <Field label="City" htmlFor="city" error={err("city")}>
                    <Input id="city" autoComplete="address-level2" aria-invalid={!!err("city")} {...register("city")} />
                  </Field>
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Facility location</p>
                    <LocationPicker
                      idPrefix="req"
                      cities={cities}
                      value={lat !== undefined && lng !== undefined ? { lat, lng } : null}
                      onChange={(p) => {
                        if (!p) return;
                        setValue("lat", p.lat, { shouldValidate: true });
                        setValue("lng", p.lng, { shouldValidate: true });
                      }}
                      error={err("lat")}
                    />
                  </div>
                </>
              )}
              <Field label="Location details (optional)" htmlFor="locationDetail" hint="Ward, floor, blood bank counter or landmark." error={err("locationDetail")}>
                <Input id="locationDetail" {...register("locationDetail")} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Urgency" htmlFor="urgency" error={err("urgency")}>
                <Select id="urgency" {...register("urgency")}>
                  {URGENCIES.map((u) => (
                    <option key={u} value={u}>{URGENCY_LABELS[u]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Contact name" htmlFor="contactName" error={err("contactName")}>
                <Input id="contactName" autoComplete="name" aria-invalid={!!err("contactName")} {...register("contactName")} />
              </Field>
              <Field label="Phone number" htmlFor="contactPhone" error={err("contactPhone")}>
                <Input id="contactPhone" type="tel" autoComplete="tel" aria-invalid={!!err("contactPhone")} {...register("contactPhone")} />
              </Field>
              <Field label="Email (optional)" htmlFor="contactEmail" error={err("contactEmail")}>
                <Input id="contactEmail" type="email" autoComplete="email" aria-invalid={!!err("contactEmail")} {...register("contactEmail")} />
              </Field>
              <Field label="Preferred contact method" htmlFor="contactPref" error={err("contactPref")}>
                <Select id="contactPref" {...register("contactPref")}>
                  <option value="phone">Phone call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </Select>
              </Field>
              <Field label="Notes (optional)" htmlFor="notes" hint="Do not include medical history or patient identifiers." error={err("notes")}>
                <Textarea id="notes" rows={3} maxLength={300} {...register("notes")} />
              </Field>
              <Checkbox
                id="consent"
                error={err("consent")}
                label="I agree that my contact details may be shared with matched facilities, and with donors who accept, so they can coordinate this request."
                {...register("consent")}
              />
            </>
          )}

          {step === 3 && (
            <>
              <Notice tone="info" title="Before you submit">
                Submitting starts a search. It does not reserve blood, confirm compatibility or replace contacting the treating hospital.
              </Notice>
              <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper text-sm">
                {[
                  ["Requirement", `${v.units} unit(s) · ${v.bloodGroup} · ${COMPONENT_LABELS[v.component] ?? ""}`, 0],
                  ["Facility", `${v.facilityName}, ${v.city}${v.locationDetail ? ` (${v.locationDetail})` : ""}`, 1],
                  ["Urgency", URGENCY_LABELS[v.urgency] ?? "", 2],
                  ["Contact", `${v.contactName} · ${v.contactPhone} · prefers ${v.contactPref}`, 2],
                  ...(v.notes ? [["Notes", v.notes, 2] as const] : []),
                ].map(([k, val, target]) => (
                  <div key={k as string} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
                      <dd className="mt-0.5 break-words">{val}</dd>
                    </div>
                    <button type="button" onClick={() => setStep(target as number)} className="shrink-0 text-xs font-semibold text-forest underline underline-offset-4">
                      Edit
                    </button>
                  </div>
                ))}
              </dl>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || isSubmitting}>
          <ArrowLeft size={16} aria-hidden /> Back
        </Button>
        {step < 3 ? (
          <Button variant="forest" onClick={next}>
            Continue <ArrowRight size={16} aria-hidden />
          </Button>
        ) : (
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={!enabled}>
            {isSubmitting ? "Submitting…" : (<><Send size={16} aria-hidden /> Submit request</>)}
          </Button>
        )}
      </div>
      {step === 3 && <p className="flex items-center gap-1.5 text-xs text-muted"><Check size={12} aria-hidden /> Duplicate submissions are blocked automatically.</p>}
    </form>
  );
}
