import { ImageResponse } from "next/og";

export const alt = "Krevo: school software for Indian schools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";


export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFFFFF", fontFamily: "sans-serif", color: "#1D1D1F" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px", width: "760px" }}>
          <svg width="120" height="120" viewBox="120 80 285 285">
            <rect x="120" y="80" width="86" height="285" rx="43" fill="#000" />
            <rect x="-128" y="-40" width="256" height="80" rx="40" fill="#000" transform="translate(274 172) rotate(-27.5)" />
            <rect x="-128" y="-40" width="256" height="80" rx="40" fill="#000" transform="translate(274 272) rotate(27.5)" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em" }}>School software</div>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", color: "#F26A1B" }}>for Indian schools.</div>
            <div style={{ fontSize: 28, marginTop: 20, color: "#6E6E73" }}>₹10 per student a month.</div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, background: "#FFF0E6", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", width: "300px", height: "500px", borderRadius: "56px", background: "#000", padding: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: "46px", background: "#fff", padding: "56px 24px 24px", gap: "16px" }}>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>Good morning</div>
              <div style={{ display: "flex", alignItems: "center", gap: "18px", background: "#F5F5F7", borderRadius: "28px", padding: "20px" }}>
                <div style={{ display: "flex", width: "84px", height: "84px", flexShrink: 0, borderRadius: "42px", background: "#F26A1B", color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800 }}>96%</div>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 800 }}>Present today</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", background: "#FFF0E6", borderRadius: "28px", padding: "20px" }}>
                <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: "#F26A1B" }}>Term 2 fee</div>
                <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>₹1,800</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
