import type { CSSProperties, ReactNode } from "react";

/** Palette for the illustrations: black, white and greys, with one orange detail per scene. */
export const P = {
  ink: "var(--c-solid)",
  dark: "#2C2C2E",
  mid: "#6E6E73",
  g4: "#A1A1A6",
  g3: "var(--c-separator)",
  g2: "var(--c-fill)",
  g1: "var(--c-card)",
  white: "#FFFFFF",
  accent: "var(--c-accent)",
};

export const drift = (o: Record<string, string | number>) => o as CSSProperties;

export function Cloud({ x, y, s = 1, speed = 14, dx = 12, delay = 0 }: { x: number; y: number; s?: number; speed?: number; dx?: number; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="drift" style={drift({ "--dx": `${dx}px`, "--dy": "0px", "--fs": `${speed}s`, "--fd": `${delay}s` })}>
        <path d="M-30 0a12 12 0 0 1 8-11a16 16 0 0 1 30-3a13 13 0 0 1 22 8a8 8 0 0 1-2 6z" fill={P.white} />
      </g>
    </g>
  );
}

export function Tree({ x, y, s = 1, tone = "a", sway = 6 }: { x: number; y: number; s?: number; tone?: "a" | "b"; sway?: number }) {
  const leaf = tone === "a" ? P.g3 : P.g4;
  const leaf2 = tone === "a" ? P.g4 : P.mid;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3" y="-34" width="6" height="34" rx="2" fill={P.mid} />
      <g className="drift" style={drift({ "--dx": "1.5px", "--dy": "-1px", "--dr": "0.8deg", "--fs": `${sway}s` })}>
        <circle cx="0" cy="-52" r="25" fill={leaf} />
        <circle cx="-12" cy="-42" r="15" fill={leaf2} opacity="0.55" />
        <circle cx="13" cy="-60" r="12" fill={P.white} opacity="0.35" />
      </g>
    </g>
  );
}

/** The school: hall with clock and pediment, two wings, steps and a waving flag. Ground at y = 0, centred on x = 0. */
export function School({ x, y, s = 1, flag = true, flagColor = P.ink }: { x: number; y: number; s?: number; flag?: boolean; flagColor?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* wings */}
      {[-1, 1].map((d) => (
        <g key={d} transform={`scale(${d} 1)`}>
          <rect x="66" y="-84" width="88" height="84" fill={P.white} />
          <rect x="62" y="-92" width="96" height="10" rx="3" fill={P.ink} />
          {[80, 112].map((wx) => (
            <path key={wx} d={`M${wx} -18V-52a11 11 0 0 1 22 0V-18z`} fill={P.g2} />
          ))}
          <rect x="66" y="-6" width="88" height="6" fill={P.g3} />
        </g>
      ))}
      {/* hall */}
      <rect x="-70" y="-116" width="140" height="116" fill={P.white} />
      <polygon points="-82,-116 0,-160 82,-116" fill={P.ink} />
      <rect x="-82" y="-118" width="164" height="7" rx="2" fill={P.dark} />
      <circle cx="0" cy="-132" r="11" fill={P.white} />
      <path d="M0 -139v7l5 3" stroke={P.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      {[-54, -38, 22, 38].map((wx) => (
        <path key={wx} d={`M${wx} -58V-86a8 8 0 0 1 16 0V-58z`} fill={P.g2} />
      ))}
      {/* columns */}
      {[-30, 30].map((cx) => (
        <rect key={cx} x={cx - 4} y="-104" width="8" height="104" fill={P.g1} />
      ))}
      <path d="M-15 0V-46a15 15 0 0 1 30 0V0z" fill={P.ink} />
      <rect x="-1" y="-44" width="2" height="44" fill={P.mid} />
      <rect x="-40" y="-6" width="80" height="6" fill={P.g3} />
      <rect x="-48" y="0" width="96" height="5" fill={P.g4} opacity="0.5" />
      {flag ? (
        <>
          <rect x="-1.5" y="-196" width="3" height="38" fill={P.ink} />
          <path className="wave" d="M1.500 -195h32l-8 8.500 8 8.500h-32z" fill={flagColor} />
        </>
      ) : null}
    </g>
  );
}

export function Bus({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -18V-66Q0 -78 12 -78H150Q162 -78 168 -68L186 -42V-18Z" fill={P.dark} />
      <rect x="0" y="-36" width="186" height="5" fill={P.accent} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={12 + i * 28} y="-68" width="22" height="22" rx="4" fill={P.g2} />
      ))}
      <path d="M154 -68H157Q161 -68 164 -63L176 -46H154Z" fill={P.g2} />
      <rect x="178" y="-34" width="8" height="6" rx="2" fill={P.white} />
      <rect x="0" y="-26" width="186" height="8" rx="3" fill={P.ink} />
      {[38, 142].map((wx) => (
        <g key={wx}>
          <circle cx={wx} cy="-12" r="15" fill={P.ink} stroke={P.white} strokeWidth="3" />
          <circle cx={wx} cy="-12" r="5.500" fill={P.g4} />
        </g>
      ))}
    </g>
  );
}

type Pose = "stand" | "phone" | "tablet" | "desk" | "hold" | "up" | "wave";
type Hair = "short" | "bun" | "long" | "curly";
type Pt = [number, number];

const ARMS: Record<Pose, { l: Pt[]; r: Pt[] }> = {
  stand: { l: [[-20, -140], [-26, -112], [-24, -88]], r: [[20, -140], [26, -112], [24, -88]] },
  phone: { l: [[-20, -140], [-26, -112], [-24, -88]], r: [[20, -140], [31, -112], [10, -116]] },
  tablet: { l: [[-20, -140], [-42, -150], [-60, -172]], r: [[20, -140], [30, -112], [10, -98]] },
  desk: { l: [[-20, -140], [-32, -120], [-20, -110]], r: [[20, -140], [38, -122], [62, -112]] },
  hold: { l: [[-20, -140], [-26, -112], [-24, -88]], r: [[20, -140], [34, -116], [46, -92]] },
  up: { l: [[-20, -140], [-34, -132], [-46, -146]], r: [[20, -140], [26, -112], [24, -88]] },
  wave: { l: [[-20, -140], [-26, -112], [-24, -88]], r: [[20, -140], [42, -148], [48, -176]] },
};

type AdultProps = {
  x: number;
  y: number;
  s?: number;
  skin: string;
  hair: Hair;
  hairColor?: string;
  top: string;
  bottom?: string;
  shirt?: string;
  pose?: Pose;
  bag?: boolean;
  dress?: boolean;
  glasses?: boolean;
  /** Only draw from the hips up (for people behind a desk). */
  seated?: boolean;
  flip?: boolean;
  children?: ReactNode;
  bob?: number;
};

/** A friendly flat figure. Local coordinates: feet at (0, 0), head near y = -170. Faces forward. */
export function Person({ x, y, s = 1, skin, hair, hairColor = P.ink, top, bottom = P.dark, shirt, pose = "stand", bag, dress, glasses, seated, flip, bob, children }: AdultProps) {
  const arms = ARMS[pose];
  const line = (pts: Pt[]) => `M${pts.map((p) => p.join(" ")).join("L")}`;
  const body = (
    <>
      {!seated ? <ellipse cx="0" cy="0" rx="28" ry="4" fill="#000" opacity="0.07" /> : null}
      {bag ? (
        <>
          <rect x="-30" y="-148" width="60" height="68" rx="16" fill={P.dark} />
          <rect x="-24" y="-112" width="48" height="26" rx="8" fill={P.ink} opacity="0.55" />
        </>
      ) : null}
      {hair === "long" ? <rect x="-22" y="-188" width="44" height="60" rx="20" fill={hairColor} /> : null}
      {!seated && !dress ? (
        <>
          <rect x="-15" y="-84" width="13" height="78" rx="6" fill={bottom} />
          <rect x="2" y="-84" width="13" height="78" rx="6" fill={bottom} />
        </>
      ) : null}
      {!seated && dress ? (
        <>
          <rect x="-11" y="-44" width="8" height="38" rx="4" fill={skin} />
          <rect x="3" y="-44" width="8" height="38" rx="4" fill={skin} />
        </>
      ) : null}
      {!seated ? (
        <>
          <path d="M-20 -3a9 6 0 0 1 9-6h8a4 6 0 0 1 0 12h-17z" fill={P.ink} />
          <path d="M20 -3a9 6 0 0 0-9-6h-8a4 6 0 0 0 0 12h17z" fill={P.ink} />
        </>
      ) : null}
      {dress ? (
        <path d="M-23 -146Q-23 -150 -18 -150H18Q23 -150 23 -146V-110L34 -46Q34 -40 28 -40H-28Q-34 -40 -34 -46L-23 -110Z" fill={top} />
      ) : (
        <path d="M-23 -76V-132Q-23 -148 -7 -148H7Q23 -148 23 -132V-76Z" fill={top} />
      )}
      {bag ? (
        <>
          <path d="M-12 -148L-15 -100" stroke={P.ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M12 -148L15 -100" stroke={P.ink} strokeWidth="5" strokeLinecap="round" />
        </>
      ) : null}
      <rect x="-5.500" y="-158" width="11" height="14" rx="5" fill={skin} />
      {shirt ? <path d="M-8 -149L0 -134L8 -149Z" fill={shirt} /> : null}
      {/* head */}
      <circle cx="-17.500" cy="-169" r="3.600" fill={skin} />
      <circle cx="17.500" cy="-169" r="3.600" fill={skin} />
      <ellipse cx="0" cy="-170" rx="17.500" ry="19.500" fill={skin} />
      {hair === "curly" ? (
        <g fill={hairColor}>
          {[-14, -7, 0, 7, 14].map((cx, i) => (
            <circle key={cx} cx={cx} cy={-184 + (i % 2 ? 2 : 0) + Math.abs(cx) * 0.28} r="8" />
          ))}
        </g>
      ) : (
        <path d="M-19.500 -168C-22 -194 22 -194 19.500 -168C14 -177 6 -180 -2 -179C-10 -178 -16 -174 -19.500 -168Z" fill={hairColor} />
      )}
      {hair === "bun" ? <circle cx="0" cy="-196" r="9" fill={hairColor} /> : null}
      {glasses ? (
        <g stroke={P.ink} strokeWidth="1.800" fill="none">
          <circle cx="-6.500" cy="-169" r="6" />
          <circle cx="6.500" cy="-169" r="6" />
          <path d="M-0.500 -169h1" />
        </g>
      ) : null}
      {/* arms */}
      {[arms.l, arms.r].map((a, i) => (
        <g key={i}>
          <path d={line(a)} stroke={dress ? skin : top} strokeWidth={dress ? 9 : 12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {!dress ? <path d={line(a.slice(-2))} stroke={top} strokeWidth="12" strokeLinecap="round" fill="none" /> : null}
        </g>
      ))}
      {children}
      {[arms.l, arms.r].map((a, i) => (
        <circle key={i} cx={a[a.length - 1][0]} cy={a[a.length - 1][1]} r="6.500" fill={skin} />
      ))}
    </>
  );
  const inner = flip ? <g transform="scale(-1 1)">{body}</g> : body;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {bob ? (
        <g className="drift" style={drift({ "--dx": "0px", "--dy": "-3px", "--fs": `${bob}s`, "--fd": `${-bob / 2}s` })}>
          {inner}
        </g>
      ) : (
        inner
      )}
    </g>
  );
}

/** A small rounded-rect tablet / phone with a placeholder list on it. */
export function Device({ x, y, w, h, rot = 0, rx = 5, children }: { x: number; y: number; w: number; h: number; rot?: number; rx?: number; children?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx} fill={P.ink} />
      <rect x={-w / 2 + 2.500} y={-h / 2 + 2.500} width={w - 5} height={h - 5} rx={rx - 2} fill={P.white} />
      {children}
    </g>
  );
}

export function Bubble({ x, y, w, label, dark, dot, delay = 0, speed = 6.5, dy = -7 }: { x: number; y: number; w: number; label: string; dark?: boolean; dot?: boolean; delay?: number; speed?: number; dy?: number }) {
  return (
    <g className="drift" style={drift({ "--dx": "0px", "--dy": `${dy}px`, "--fs": `${speed}s`, "--fd": `${delay}s` })}>
      <rect x={x} y={y} width={w} height="26" rx="13" fill={dark ? P.ink : P.white} />
      {dot ? <circle cx={x + 14} cy={y + 13} r="5" fill={P.accent} /> : <circle cx={x + 14} cy={y + 13} r="5" fill={dark ? P.white : P.ink} />}
      <text x={x + 26} y={y + 17.500} fontSize="11" fontWeight="700" fill={dark ? P.white : P.ink} fontFamily="inherit">
        {label}
      </text>
    </g>
  );
}
