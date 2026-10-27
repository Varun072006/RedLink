import type { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: string, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return { ok: false, error, fieldErrors };
}

export function zodFail(err: ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fail("Please correct the highlighted fields.", fieldErrors);
}

const SAFE_DB_MESSAGES = [
  "facility is not verified",
  "no facility access",
  "units cannot be lower",
  "adjustment would leave",
  "not enough unreserved stock",
  "you have already responded",
  "this request is no longer open",
  "this request was already answered",
  "request not found",
  "only a confirmed reservation",
  "no active reservation",
  "opt in to requests",
  "donor code not recognised",
  "this account is already linked",
  "only active facility staff",
  "only the facility owner",
  "administrator access required",
];

export function dbFail(err: { message?: string } | null, fallback = "Something went wrong. Please try again."): { ok: false; error: string } {
  const msg = err?.message ?? "";
  const safe = SAFE_DB_MESSAGES.find((m) => msg.includes(m));
  return { ok: false, error: safe ? capitalize(msg) : fallback };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
