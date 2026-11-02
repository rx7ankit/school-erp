/**
 * Hero backdrop: delicate monochrome line work radiating from behind the dashboard, over a very light grey stage.
 * Pure SVG + CSS. Only opacity animates (a slow pulse that travels outward). Positioned by the parent: the
 * centre of the pattern sits at `--ox` from the top of this box, which the hero lines up with the top of the panel.
 */
const R0 = 150;
const STEP = 52;
const N = 22;

function Rings() {
  return (
    <g fill="none">
      {Array.from({ length: N }, (_, i) => {
        const r = R0 + i * STEP;
        const strong = i % 4 === 0;
        return (
          <circle
            key={i}
            className="hv-ring"
            cx="800"
            cy="0"
            r={r}
            stroke={strong ? "#CFCFD6" : "#DDDDE3"}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            style={{ animationDelay: `${i * 0.42}s` }}
          />
        );
      })}
      {/* a fine dial of ticks, like an instrument bezel */}
      <circle cx="800" cy="0" r={R0 + 7 * STEP + 26} stroke="#D2D2D9" strokeWidth="8" strokeDasharray="1 9" vectorEffect="non-scaling-stroke" />
      <circle cx="800" cy="0" r={R0 + 13 * STEP + 26} stroke="#DCDCE2" strokeWidth="8" strokeDasharray="1 13" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

export function HeroBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`[--o:576px] [mask-image:linear-gradient(to_bottom,#000_calc(100%-260px),transparent_100%)] max-sm:[--o:396px] ${className ?? ""}`}>
      {/* very light grey stage, white at the top so it melts into the headline area */}
      <div className="absolute inset-0 [background:linear-gradient(to_bottom,#fff_0,#fff_calc(var(--o)-60px),#F5F5F7_calc(var(--o)+220px),#F3F3F6_100%)]" />
      {/* the single faint warm glow behind the panel */}
      <div className="absolute left-1/2 top-[var(--o)] h-[240px] w-[min(760px,90%)] -translate-x-1/2 rounded-full bg-[#FFE9DA]/40 blur-[90px] max-sm:h-[140px]" />
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_900px_640px_at_50%_var(--o),#000_42%,transparent_100%)] max-sm:[mask-image:radial-gradient(ellipse_460px_380px_at_50%_var(--o),#000_22%,transparent_100%)]">
        <svg
          viewBox="0 -800 1600 1600"
          className="absolute left-1/2 top-[var(--o)] h-[1600px] w-[1600px] -translate-x-1/2 -translate-y-1/2 max-sm:h-[1000px] max-sm:w-[1000px]"
        >
          <Rings />
        </svg>
      </div>
    </div>
  );
}
