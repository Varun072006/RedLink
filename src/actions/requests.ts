"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { isServiceConfigured } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";
import { cancelRequestByToken, createBloodRequest } from "@/lib/server/request-service";

export async function createRequestAction(
  input: unknown,
  submissionId: string,
): Promise<ActionResult<{ token: string; reference: string }>> {
  if (!isServiceConfigured()) {
    return fail("Requests cannot be submitted until the backend is configured. Please contact the treating facility directly.");
  }
  const user = await getSessionUser();
  return createBloodRequest(input, submissionId, user && user.status === "active" ? user.id : null);
}

export async function cancelRequestAction(token: string): Promise<ActionResult> {
  if (!isServiceConfigured()) return fail("Backend is not configured.");
  const res = await cancelRequestByToken(token);
  if (res.ok) revalidatePath(`/track/${token}`);
  return res;
}
