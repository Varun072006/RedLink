import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isServiceConfigured } from "@/lib/env";
import { maintainActiveRequests } from "@/lib/server/matching-service";
import { dispatchPendingPush } from "@/lib/server/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isServiceConfigured()) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  const maintenance = await maintainActiveRequests();
  const push = await dispatchPendingPush();
  return NextResponse.json({ ok: true, maintenance, push });
}
