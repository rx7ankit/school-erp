import Image from "next/image";
import { P } from "./parts";

const LINE = "#DADAE0";

/** Soft grey panel behind the hero devices with a faint line drawing of the school. Pass `photo` to use a photo instead. */
export function HeroBackdrop({ photo }: { photo?: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[-3%] top-[6%] overflow-hidden rounded-[28px] bg-card sm:inset-x-[-1.5%] sm:rounded-[44px]">
      {photo ? (
        <Image src={photo} alt="" fill sizes="100vw" className="object-cover" />
      ) : (
        <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full" fill="none" stroke={LINE} strokeWidth="2.500" strokeLinecap="round" strokeLinejoin="round">
          {/* ground */}
          <path d="M0 540H1200" />
          <path d="M0 560H1200" opacity="0.6" />
          {/* left wing + tower with flag */}
          <g>
            <path d="M40 540V310H250V540" />
            <path d="M30 310H260" />
            {[0, 1, 2, 3].map((i) => (
              <path key={i} d={`M${68 + i * 46} 520V420a14 14 0 0 1 28 0V520`} />
            ))}
            <path d="M40 360H250" opacity="0.6" />
            <path d="M250 540V200H330V540" />
            <path d="M242 200H338" />
            <path d="M262 200V160L290 134L318 160V200" />
            <path d="M290 134V74" />
            <path d="M290 76h46l-12 12 12 12h-46" stroke="none" fill={LINE} />
            <circle cx="290" cy="244" r="16" />
            <path d="M290 233v12l8 5" />
            <path d="M268 520V420a22 22 0 0 1 44 0V520" />
          </g>
          {/* right wing */}
          <g>
            <path d="M960 540V300H1170V540" />
            <path d="M950 300H1180" />
            {[0, 1, 2, 3].map((i) => (
              <path key={i} d={`M${988 + i * 46} 520V420a14 14 0 0 1 28 0V520`} />
            ))}
            <path d="M960 350H1170" opacity="0.6" />
          </g>
          {/* trees */}
          <g>
            <path d="M376 540V478" />
            <circle cx="376" cy="450" r="34" />
            <path d="M884 540V488" />
            <circle cx="884" cy="466" r="28" />
          </g>
          {/* sun + clouds */}
          <circle cx="1040" cy="150" r="46" />
          <path d="M470 130a18 18 0 0 1 14-17a26 26 0 0 1 48 4a15 15 0 0 1 20 13z" />
          <path d="M720 84a14 14 0 0 1 11-13a21 21 0 0 1 38 3a12 12 0 0 1 16 10z" />
        </svg>
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-bg/40 to-transparent" style={{ color: P.ink }} />
    </div>
  );
}
