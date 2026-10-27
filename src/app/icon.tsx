import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 32, height: 32, borderRadius: 16, background: "#782a38", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 18, height: 3, background: "#f5f0e7" }} />
      </div>
    ),
    size,
  );
}
