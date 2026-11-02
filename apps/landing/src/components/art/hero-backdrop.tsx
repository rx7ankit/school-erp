/**
 * The one coloured thing on the page: a rounded canvas behind the hero devices. A pastel mesh (peach, lilac, sky,
 * mint) made of blurred radial blobs that drift very slowly, a fine dot grid and grain on top, and a thin inner
 * highlight. Pure CSS; the blobs only animate transform. Devices overlap its edges so the hero feels layered.
 */
const BLOBS = [
  // [position, colour, size, drift x, drift y, seconds, delay]
  ["left-[-12%] top-[-22%]", "#FFD9BF", "62%", "6%", "8%", 28, 0],
  ["right-[-14%] top-[-30%]", "#D9CEFF", "66%", "-7%", "6%", 32, -9],
  ["left-[18%] bottom-[-46%]", "#C9E6FF", "70%", "8%", "-6%", 30, -14],
  ["right-[-10%] bottom-[-34%]", "#CDF3DF", "58%", "-6%", "-8%", 34, -5],
] as const;

export function HeroBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <div className="absolute inset-0 overflow-hidden rounded-[28px] bg-[#F6F1F8] sm:rounded-[44px]">
        {BLOBS.map(([pos, color, size, bx, by, s, d], i) => (
          <div
            key={i}
            className={`blob absolute aspect-square rounded-full blur-[48px] ${pos}`}
            style={{ width: size, background: `radial-gradient(circle at 50% 50%, ${color} 0%, ${color}cc 38%, ${color}00 70%)`, "--bx": bx, "--by": by, "--bs": `${s}s`, "--bd": `${d}s` } as React.CSSProperties}
          />
        ))}
        {/* soft light behind the devices */}
        <div className="absolute inset-x-[10%] top-[10%] h-[70%] [background:radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(255,255,255,0.55),transparent_100%)]" />
        {/* dot grid, strongest toward the edges of the canvas */}
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_center,rgba(60,50,90,0.22)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_80%_75%_at_50%_50%,transparent_35%,#000_100%)]" />
        <div className="grain absolute inset-0 opacity-[0.22] mix-blend-multiply" />
        {/* inner highlight */}
        <div className="absolute inset-0 rounded-[inherit] border border-white/70" />
        <div className="absolute inset-x-0 top-0 h-1/3 rounded-t-[inherit] [background:linear-gradient(to_bottom,rgba(255,255,255,0.38),transparent)]" />
      </div>
    </div>
  );
}
