import Image from "next/image";
import { Bus, Cloud, P, Person, School, Tree } from "./parts";

const W = 1600;
const H = 260;
const G = 224; // ground line

/** One seamless tile of the school-day strip. Nothing crosses the tile edges. */
function Tile() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block h-[190px] w-auto shrink-0 md:h-[260px]">
      <rect y={G} width={W} height={H - G} fill={P.g2} />
      <rect y={G} width={W} height="3" fill={P.g3} />
      {/* road dashes */}
      {Array.from({ length: 26 }, (_, i) => (
        <rect key={i} x={20 + i * 62} y={G + 22} width="30" height="4" rx="2" fill={P.white} opacity="0.9" />
      ))}
      <Cloud x={190} y={60} s={1.1} speed={16} dx={18} />
      <Cloud x={720} y={44} s={0.9} speed={13} dx={-14} delay={-5} />
      <Cloud x={1180} y={74} s={1.2} speed={18} dx={16} delay={-8} />
      <Cloud x={1500} y={50} s={0.8} speed={12} dx={-10} delay={-2} />

      <Tree x={50} y={G} s={1.15} />
      <School x={300} y={G} s={0.96} />
      <Tree x={540} y={G} s={0.9} tone="b" sway={7} />
      <Person x={610} y={G + 14} s={0.5} skin="#CFCFD4" hair="short" top={P.white} bag bob={3} />
      <Person x={656} y={G + 18} s={0.56} skin="#A4A4AA" hair="curly" top={P.dark} bag bob={3.6} />
      <Person x={706} y={G + 14} s={0.5} skin="#B4B4BA" hair="bun" top="#8E8E93" dress bag bob={3.3} />
      <Bus x={790} y={G + 6} s={1.18} />
      <Tree x={1070} y={G} s={1} />
      <Tree x={1126} y={G} s={0.78} tone="b" sway={8} />
      <Person x={1206} y={G + 16} s={0.54} skin="#C8C8CD" hair="bun" top={P.ink} dress bag bob={3.4} />
      <Person x={1250} y={G + 14} s={0.46} skin="#A4A4AA" hair="short" top={P.white} bag bob={2.8} />
      <Person x={1312} y={G + 16} s={0.66} skin="#9C9CA2" hair="long" top={P.dark} dress pose="wave" bob={4} />
      {/* small library */}
      <g transform={`translate(1450 ${G})`}>
        <rect x="-62" y="-70" width="124" height="70" fill={P.white} />
        <rect x="-68" y="-80" width="136" height="12" rx="3" fill={P.ink} />
        <path d="M-12 0V-34a12 12 0 0 1 24 0V0z" fill={P.ink} />
        {[-46, 30].map((wx) => (
          <path key={wx} d={`M${wx} -18V-44a8 8 0 0 1 16 0V-18z`} fill={P.g2} />
        ))}
      </g>
      <Tree x={1566} y={G} s={0.85} tone="b" sway={9} />
    </svg>
  );
}

/**
 * Full-bleed illustrated strip that drifts slowly and loops without a seam.
 * Pass `photo` to show a wide still photo instead (recommended 2400 x 400).
 */
export function SchoolDayBand({ photo }: { photo?: string }) {
  return (
    <div className="relative overflow-hidden bg-card" role={photo ? undefined : "img"} aria-label={photo ? undefined : "Children arriving at school by bus and on foot"}>
      {photo ? (
        <div className="relative h-[190px] md:h-[260px]">
          <Image src={photo} alt="Children arriving at school" fill sizes="100vw" className="object-cover" />
        </div>
      ) : (
        <div className="band flex w-max" aria-hidden="true">
          <Tile />
          <Tile />
        </div>
      )}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg to-transparent md:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg to-transparent md:w-40" />
    </div>
  );
}
