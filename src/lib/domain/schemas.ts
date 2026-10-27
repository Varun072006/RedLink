import { z } from "zod";
import { BLOOD_GROUPS, COMPONENTS, URGENCIES } from "./blood";

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number");
const lat = z.number({ error: "Choose a location" }).min(-90).max(90);
const lng = z.number({ error: "Choose a location" }).min(-180).max(180);
const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`);

export const bloodGroupSchema = z.enum(BLOOD_GROUPS, { error: "Choose a blood group" });
export const componentSchema = z.enum(COMPONENTS, { error: "Choose a component" });
export const urgencySchema = z.enum(URGENCIES, { error: "Choose an urgency" });

export const requirementSchema = z.object({
  bloodGroup: bloodGroupSchema,
  component: componentSchema,
  units: z.number({ error: "Enter the number of units" }).int("Whole units only").min(1, "At least 1 unit").max(20, "Up to 20 units per request"),
});

export const destinationSchema = z
  .object({
    facilityMode: z.enum(["registered", "other"]),
    centreId: z.string().uuid().optional(),
    facilityName: text("Facility name", 120),
    city: text("City", 80),
    locationDetail: z.string().trim().max(200).optional(),
    lat,
    lng,
  })
  .refine((v) => v.facilityMode !== "registered" || !!v.centreId, {
    path: ["centreId"],
    message: "Choose a facility",
  });

export const contactSchema = z
  .object({
    urgency: urgencySchema,
    contactPref: z.enum(["phone", "whatsapp", "email"], { error: "Choose how to be contacted" }),
    contactName: text("Contact name", 80),
    contactPhone: phone,
    contactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
    notes: z.string().trim().max(300, "Notes must be 300 characters or fewer").optional(),
    consent: z.literal(true, { error: "Consent is required to coordinate your request" }),
  })
  .refine((v) => v.contactPref !== "email" || !!v.contactEmail, {
    path: ["contactEmail"],
    message: "Email is required when email is preferred",
  });

export const bloodRequestSchema = z.intersection(
  z.intersection(requirementSchema, destinationSchema),
  contactSchema,
);
export type BloodRequestInput = z.infer<typeof bloodRequestSchema>;

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  displayName: text("Name", 80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(128),
  role: z.enum(["requester", "donor", "staff"], { error: "Choose an account type" }),
});

export const forgotSchema = z.object({ email: z.string().trim().email("Enter a valid email") });
export const newPasswordSchema = z.object({ password: z.string().min(10, "Use at least 10 characters").max(128) });

export const donorProfileSchema = z
  .object({
    bloodGroup: bloodGroupSchema,
    city: text("City", 80),
    lat,
    lng,
    lastDonationOn: z.union([z.literal(""), z.string().date("Enter a valid date")]).optional(),
    optedIn: z.boolean(),
    availability: z.enum(["available", "paused", "unavailable"]),
  })
  .refine((v) => v.optedIn || v.availability !== "available", {
    path: ["availability"],
    message: "Opt in to receiving requests before setting yourself as available",
  });

export const centreRegistrationSchema = z.object({
  name: text("Facility name", 120),
  kind: z.enum(["hospital", "blood_bank"], { error: "Choose a facility type" }),
  city: text("City", 80),
  address: text("Address", 200),
  lat,
  lng,
  phone,
  licenseRef: text("Licence or registration reference", 80),
});

export const inventorySetSchema = z.object({
  bloodGroup: bloodGroupSchema,
  component: componentSchema,
  units: z.number({ error: "Enter a number" }).int().min(0).max(10000),
  reason: z.string().trim().max(200).optional(),
});

export const inventoryDeltaSchema = z.object({
  bloodGroup: bloodGroupSchema,
  component: componentSchema,
  delta: z.number({ error: "Enter a number" }).int().min(-10000).max(10000).refine((n) => n !== 0, "Change cannot be zero"),
  reason: z.string().trim().min(1, "Give a reason").max(200),
});

export const profileSettingsSchema = z.object({
  displayName: text("Name", 80),
  phone: z.union([z.literal(""), phone]).optional(),
});
