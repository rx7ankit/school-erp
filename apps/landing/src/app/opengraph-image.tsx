import { ImageResponse } from "next/og";
import { LOCKUP_VIEWBOX, MARK, MARK_T, WORDMARK, WORD_T } from "@/components/logo";

export const alt = "Krevo: school management made easy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share preview: just the brand and the promise. Same soft grey-to-white wash with a blush glow as the site hero. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 84px",
          background: "linear-gradient(180deg, #ECECF0 0%, #FFFFFF 62%, #FFEADC 100%)",
          fontFamily: "sans-serif",
          color: "#1D1D1F",
        }}
      >
        <svg width="238" height="77" viewBox={LOCKUP_VIEWBOX}>
          <g fill="#1D1D1F">
            <g transform={MARK_T}>{MARK}</g>
            <path d={WORDMARK} transform={WORD_T} />
          </g>
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.04em" }}>School management,</div>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.04em", color: "#8E8E93" }}>made easy.</div>
          <div style={{ fontSize: 32, marginTop: 28, color: "#6E6E73" }}>Attendance, fees, results and parent updates.</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#8E8E93" }}>krevo.tech</div>
      </div>
    ),
    size,
  );
}
