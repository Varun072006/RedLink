import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, background: "#782a38", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 90, height: 90, borderRadius: 45, background: "#f5f0e7", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 50, height: 9, background: "#782a38" }} />
        </div>
      </div>
    ),
    size,
  );
}
