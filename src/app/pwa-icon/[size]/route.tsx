import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

const ALLOWED = new Set([192, 512]);

export async function GET(request: NextRequest, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = Number(raw);
  if (!ALLOWED.has(size)) return new Response("Not found", { status: 404 });
  const maskable = request.nextUrl.searchParams.get("maskable") === "1";
  const disc = Math.round(size * (maskable ? 0.5 : 0.62));
  const bar = Math.round(disc * 0.56);
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: maskable ? "#782a38" : "#f5f0e7" }}>
        <div style={{ width: disc, height: disc, borderRadius: "50%", background: maskable ? "#f5f0e7" : "#782a38", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: bar, height: Math.max(6, Math.round(disc * 0.09)), background: maskable ? "#782a38" : "#f5f0e7" }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
