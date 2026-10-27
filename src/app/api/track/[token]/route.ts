import { NextResponse, type NextRequest } from "next/server";
import { isServiceConfigured } from "@/lib/env";
import { allowByClient } from "@/lib/server/rate-limit";
import { getTrackingView } from "@/lib/server/request-service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  if (!isServiceConfigured()) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  if (!(await allowByClient("track", 120, 600))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const { token } = await ctx.params;
  const view = await getTrackingView(token, { maintain: true });
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
