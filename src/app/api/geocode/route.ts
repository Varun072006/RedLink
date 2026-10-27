import { NextResponse, type NextRequest } from "next/server";
import { isGeocodeConfigured, isServiceConfigured } from "@/lib/env";
import { allowByClient } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

interface GeoHit {
  display_name?: string;
  lat?: string;
  lon?: string;
}

export async function GET(request: NextRequest) {
  if (!isGeocodeConfigured()) {
    return NextResponse.json({ error: "Address search is not configured." }, { status: 501 });
  }
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 120) return NextResponse.json({ error: "Enter at least 3 characters." }, { status: 400 });
  if (isServiceConfigured() && !(await allowByClient("geocode", 30, 60))) {
    return NextResponse.json({ error: "Too many searches. Please wait a moment." }, { status: 429 });
  }
  const url = new URL(process.env.GEOCODE_URL!);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  if (process.env.GEOCODE_API_KEY) url.searchParams.set("key", process.env.GEOCODE_API_KEY);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": process.env.GEOCODE_USER_AGENT || "REDLINK/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error("upstream");
    const hits = (await res.json()) as GeoHit[];
    const results = hits
      .filter((h) => h.lat && h.lon)
      .map((h) => ({ label: (h.display_name ?? q).slice(0, 160), lat: Number(h.lat), lng: Number(h.lon) }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Address search is unavailable right now." }, { status: 502 });
  }
}
