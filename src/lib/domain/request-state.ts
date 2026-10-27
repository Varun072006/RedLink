import type { Urgency } from "./blood";

export const REQUEST_STATUSES = [
  "submitted",
  "matching",
  "awaiting_response",
  "availability_confirmed",
  "fulfilled",
  "cancelled",
  "expired",
  "rejected",
  "unresolved",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const TERMINAL_STATUSES: readonly RequestStatus[] = ["fulfilled", "cancelled", "expired", "rejected", "unresolved"];

const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  submitted: ["matching", "awaiting_response", "cancelled", "expired", "rejected"],
  matching: ["awaiting_response", "availability_confirmed", "cancelled", "expired", "rejected", "unresolved"],
  awaiting_response: ["matching", "availability_confirmed", "cancelled", "expired", "rejected", "unresolved"],
  availability_confirmed: ["awaiting_response", "fulfilled", "cancelled", "expired", "unresolved"],
  fulfilled: [],
  cancelled: [],
  expired: [],
  rejected: [],
  unresolved: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  matching: "Searching for sources",
  awaiting_response: "Waiting for responses",
  availability_confirmed: "Availability confirmed by a facility",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  expired: "Expired",
  rejected: "Rejected",
  unresolved: "Closed without a confirmed source",
};

const EXPIRY_HOURS: Record<Urgency, number> = { critical: 6, urgent: 24, standard: 72 };

export function computeExpiry(urgency: Urgency, from: Date): Date {
  return new Date(from.getTime() + EXPIRY_HOURS[urgency] * 3_600_000);
}

export function isExpired(expiresAt: Date | string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

const RADIUS_STEPS_KM = [10, 25, 50, 100];

export function nextSearchRadius(currentKm: number): number | null {
  return RADIUS_STEPS_KM.find((r) => r > currentKm) ?? null;
}

export function initialRadiusKm(urgency: Urgency): number {
  return urgency === "critical" ? 25 : 10;
}
