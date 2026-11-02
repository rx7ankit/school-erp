import Image from "next/image";
import { Bus, Cloud, P, Person, School, Sky, Tree } from "./parts";

const W = 1600;
const H = 260;
const G = 224; // ground line

/** One seamless tile of the school-day strip. Nothing crosses the tile edges. */
function Tile() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block h-[190px] w-auto shrink-0 md:h-[260px]">
      <Sky id="sky-band" w={W} h={G} />
      <rect y={G - 10} width={W} height="14" fill={P.grass} />
      <rect y={G + 4} width={W} height={H - G - 4} fill={P.road} />
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
      <Person x={610} y={G + 14} s={0.5} skin={P.skinC} hair="short" top={P.white} bottom={P.navy} bag bob={3} />
      <Person x={656} y={G + 18} s={0.56} skin={P.skinA} hair="curly" top={P.white} bottom={P.navy} bag bob={3.6} />
      <Person x={706} y={G + 14} s={0.5} skin={P.skinB} hair="bun" top={P.mustard} dress bag bob={3.3} />
      <Bus x={790} y={G + 6} s={1.18} />
      <Tree x={1070} y={G} s={1} />
      <Tree x={1126} y={G} s={0.78} tone="b" sway={8} />
      <Person x={1206} y={G + 16} s={0.54} skin={P.skinC} hair="bun" top={P.maroon} dress bag bob={3.4} />
      <Person x={1250} y={G + 14} s={0.46} skin={P.skinB} hair="short" top={P.white} bottom={P.navy} bag bob={2.8} />
      <Person x={1312} y={G + 16} s={0.66} skin={P.skinA} hair="long" top={P.teal} dress pose="wave" bob={4} />
      {/* small library */}
      <g transform={`translate(1450 ${G})`}>
        <rect x="-62" y="-70" width="124" height="70" fill={P.cream} />
        <rect x="-68" y="-80" width="136" height="12" rx="3" fill={P.brick} />
        <path d="M-12 0V-34a12 12 0 0 1 24 0V0z" fill="#5A3A2B" />
        {[-46, 30].map((wx) => (
          <path key={wx} d={`M${wx} -18V-44a8 8 0 0 1 16 0V-18z`} fill={P.sky} />
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
    <div className="relative overflow-hidden bg-[#F6EFE2]" role={photo ? undefined : "img"} aria-label={photo ? undefined : "Children arriving at school by bus and on foot"}>
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
