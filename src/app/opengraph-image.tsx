import { ImageResponse } from "next/og";

export const alt = "VastraX coordinated two-piece fashion sets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 76px", background: "#fbf9f6", color: "#29231f", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 24, fontWeight: 700, letterSpacing: 8 }}>
        <div style={{ width: 54, height: 54, borderRadius: 15, background: "#29231f", color: "#fffefa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 31, letterSpacing: 0 }}>V</div>
        VASTRAX
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 68, display: "flex", flexDirection: "column", fontWeight: 500, letterSpacing: -4, lineHeight: 1.05 }}>Two pieces.<br />One complete look.</div>
        <div style={{ fontSize: 25, color: "#6f6257" }}>Coordinated sets for women</div>
      </div>
      <div style={{ display: "flex", width: 92, height: 6, background: "#e07a3f", borderRadius: 5 }} />
    </div>,
    { ...size },
  );
}
