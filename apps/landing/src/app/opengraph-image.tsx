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
            <path d="M213 88V262A87 87 0 0 1 213 88Z" fill="#000" />
            <path d="M222 88H310A88 87 0 0 1 398 175H310C262 175 222 150 222 125Z" fill="#000" />
            <g transform="rotate(180 261.5 222.5)">
              <path d="M213 88V262A87 87 0 0 1 213 88Z" fill="#000" />
              <path d="M222 88H310A88 87 0 0 1 398 175H310C262 175 222 150 222 125Z" fill="#000" />
            </g>
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em" }}>School software</div>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", color: "#86868B" }}>for Indian schools.</div>
            <div style={{ fontSize: 28, marginTop: 20, color: "#6E6E73" }}>₹10 per student a month.</div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, background: "#F5F5F7", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", width: "300px", height: "500px", borderRadius: "56px", background: "#000", padding: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: "46px", background: "#fff", padding: "56px 24px 24px", gap: "16px" }}>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>Good morning</div>
              <div style={{ display: "flex", alignItems: "center", gap: "18px", background: "#F5F5F7", borderRadius: "28px", padding: "20px" }}>
                <div style={{ display: "flex", width: "84px", height: "84px", flexShrink: 0, borderRadius: "42px", background: "#111", color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800 }}>96%</div>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 800 }}>Present today</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", background: "#F5F5F7", borderRadius: "28px", padding: "20px" }}>
                <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: "#6E6E73" }}>Term 2 fee</div>
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
