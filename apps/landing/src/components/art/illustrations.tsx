import type { CSSProperties } from "react";

/** Flat brand illustrations: black, white and greys, with one orange detail each. Drawn inline, animated with transform only. */

const C = {
  ink: "var(--c-solid)",
  white: "#FFFFFF",
  g1: "var(--c-card)",
  g2: "var(--c-fill)",
  g3: "var(--c-separator)",
  g4: "var(--c-text-tertiary)",
  accent: "var(--c-accent)",
  soft: "var(--c-fill)",
};
const v = (o: Record<string, string | number>) => o as CSSProperties;

function Svg({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 320 220" role="img" aria-label={label} className="h-auto w-full">
      {children}
    </svg>
  );
}

export function SchoolArt() {
  return (
    <Svg label="A school building with a flag">
      <circle cx="160" cy="112" r="92" fill={C.soft} />
      <g className="drift" style={v({ "--dx": "10px", "--dy": "0px", "--fs": "14s" })}>
        <ellipse cx="52" cy="52" rx="24" ry="9" fill={C.white} />
        <ellipse cx="68" cy="45" rx="16" ry="9" fill={C.white} />
      </g>
      <g className="drift" style={v({ "--dx": "-8px", "--dy": "0px", "--fs": "11s", "--fd": "-3s" })}>
        <ellipse cx="268" cy="70" rx="20" ry="8" fill={C.white} />
        <ellipse cx="256" cy="64" rx="12" ry="7" fill={C.white} />
      </g>
      <rect x="0" y="188" width="320" height="32" fill={C.g2} />
      {/* wings */}
      <rect x="44" y="128" width="54" height="62" fill={C.white} />
      <rect x="40" y="120" width="62" height="10" rx="3" fill={C.ink} />
      <rect x="222" y="128" width="54" height="62" fill={C.white} />
      <rect x="218" y="120" width="62" height="10" rx="3" fill={C.ink} />
      <rect x="58" y="140" width="26" height="30" rx="4" fill={C.g2} />
      <rect x="236" y="140" width="26" height="30" rx="4" fill={C.g2} />
      {/* main hall */}
      <rect x="96" y="92" width="128" height="98" fill={C.white} />
      <polygon points="84,94 160,50 236,94" fill={C.ink} />
      <circle cx="160" cy="80" r="12" fill={C.accent} />
      <path d="M160 73v7l5 3" stroke={C.white} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <rect x="110" y="106" width="26" height="32" rx="5" fill={C.g2} />
      <rect x="184" y="106" width="26" height="32" rx="5" fill={C.g2} />
      <rect x="140" y="140" width="40" height="50" rx="6" fill={C.ink} />
      <circle cx="171" cy="166" r="2.6" fill={C.white} />
      <rect x="130" y="186" width="60" height="6" rx="2" fill={C.g3} />
      {/* flag */}
      <rect x="159" y="22" width="3" height="30" fill={C.ink} />
      <path className="wave" d="M162 23h30l-8 8 8 8h-30z" fill={C.ink} />
      {/* trees */}
      <g className="drift" style={v({ "--dx": "2px", "--dy": "-2px", "--fs": "6s" })}>
        <rect x="22" y="160" width="5" height="30" fill={C.g4} />
        <circle cx="24.500" cy="150" r="20" fill={C.g3} />
      </g>
      <g className="drift" style={v({ "--dx": "-2px", "--dy": "-2px", "--fs": "7s", "--fd": "-2s" })}>
        <rect x="294" y="160" width="5" height="30" fill={C.g4} />
        <circle cx="296.500" cy="150" r="20" fill={C.g3} />
      </g>
    </Svg>
  );
}

export function NotebookArt() {
  const rows = [0, 1, 2];
  return (
    <Svg label="A notebook with a checklist and a pencil">
      <circle cx="160" cy="112" r="92" fill={C.soft} />
      <rect x="0" y="188" width="320" height="32" fill={C.g2} />
      <g transform="rotate(-4 150 112)">
        <rect x="86" y="30" width="148" height="162" rx="14" fill={C.white} />
        <path d="M86 44a14 14 0 0 1 14-14h120a14 14 0 0 1 14 14v18H86z" fill={C.ink} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={106 + i * 24} y="24" width="7" height="16" rx="3.500" fill={C.g3} />
        ))}
        <text x="102" y="54" fontSize="11.500" fontWeight="700" fill={C.white} fontFamily="inherit">
          Class 8-B
        </text>
        {rows.map((i) => (
          <g key={i} transform={`translate(0 ${i * 34})`}>
            <circle cx="108" cy="90" r="10" fill={i === 2 ? C.g2 : C.soft} />
            {i < 2 ? <path d="m103 90 4 4 7-8" stroke={C.ink} strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
            <rect x="126" y="82" width={i === 1 ? 70 : 88} height="8" rx="4" fill={C.g2} />
            <rect x="126" y="96" width={i === 1 ? 44 : 56} height="6" rx="3" fill={C.g1} />
          </g>
        ))}
      </g>
      {/* badge */}
      <g className="drift" style={v({ "--dx": "0px", "--dy": "-7px", "--fs": "5s" })}>
        <circle cx="236" cy="62" r="25" fill={C.accent} />
        <text x="236" y="69" textAnchor="middle" fontSize="19" fontWeight="800" fill={C.white} fontFamily="inherit">
          A+
        </text>
      </g>
      {/* pencil */}
      <g className="drift" style={v({ "--dx": "-4px", "--dy": "-4px", "--dr": "-3deg", "--fs": "7s", "--fd": "-1s" })}>
        <g transform="translate(206 176) rotate(-38)">
          <rect x="-4" y="-9" width="14" height="18" rx="4" fill={C.g3} />
          <rect x="10" y="-9" width="8" height="18" fill={C.g2} />
          <rect x="18" y="-9" width="62" height="18" fill={C.g4} />
          <polygon points="80,-9 104,0 80,9" fill={C.g3} />
          <polygon points="97,-3 104,0 97,3" fill={C.ink} />
        </g>
      </g>
    </Svg>
  );
}

export function PhoneArt() {
  return (
    <Svg label="A phone with notification bubbles">
      <circle cx="160" cy="112" r="92" fill={C.soft} />
      <rect x="0" y="188" width="320" height="32" fill={C.g2} />
      {/* phone */}
      <rect x="112" y="24" width="96" height="168" rx="20" fill={C.ink} />
      <rect x="118" y="30" width="84" height="156" rx="15" fill={C.white} />
      <rect x="149" y="35" width="22" height="6" rx="3" fill={C.ink} />
      <circle cx="134" cy="62" r="9" fill={C.soft} />
      <rect x="148" y="55" width="40" height="6" rx="3" fill={C.g3} />
      <rect x="148" y="66" width="26" height="5" rx="2.500" fill={C.g2} />
      <rect x="128" y="84" width="64" height="44" rx="10" fill={C.g1} />
      <circle cx="146" cy="106" r="11" fill="none" stroke={C.g3} strokeWidth="4.500" />
      <path d="M146 95a11 11 0 1 1-10.500 14" fill="none" stroke={C.accent} strokeWidth="4.500" strokeLinecap="round" />
      <rect x="164" y="98" width="20" height="6" rx="3" fill={C.ink} />
      <rect x="164" y="109" width="14" height="5" rx="2.500" fill={C.g3} />
      <rect x="128" y="136" width="64" height="16" rx="8" fill={C.g1} />
      <rect x="128" y="158" width="64" height="16" rx="8" fill={C.soft} />
      {/* bubbles */}
      <g className="drift" style={v({ "--dx": "4px", "--dy": "-8px", "--fs": "6s" })}>
        <rect x="14" y="52" width="112" height="36" rx="18" fill={C.white} />
        <circle cx="34" cy="70" r="11" fill={C.ink} />
        <path d="m29 70 4 4 7-8" stroke={C.white} strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="52" y="74" fontSize="12" fontWeight="700" fill={C.ink} fontFamily="inherit">
          Present
        </text>
      </g>
      <g className="drift" style={v({ "--dx": "-5px", "--dy": "-6px", "--fs": "7.500s", "--fd": "-2s" })}>
        <rect x="196" y="96" width="112" height="36" rx="18" fill={C.ink} />
        <text x="214" y="119" fontSize="12" fontWeight="700" fill={C.white} fontFamily="inherit">
          Results out
        </text>
      </g>
      <g className="drift" style={v({ "--dx": "6px", "--dy": "-7px", "--fs": "8s", "--fd": "-4s" })}>
        <rect x="22" y="132" width="106" height="36" rx="18" fill={C.ink} />
        <text x="40" y="155" fontSize="12" fontWeight="700" fill={C.white} fontFamily="inherit">
          Fee ₹1,800
        </text>
      </g>
    </Svg>
  );
}
