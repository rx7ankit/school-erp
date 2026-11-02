import { ArrowRightIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { HERO } from "@/lib/content";
import { HeroBackdrop } from "@/components/art/hero-backdrop";
import { HeroVisual } from "@/components/mockups/devices";

export function Hero() {
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
  return (
    <section id="top" aria-labelledby="hero-h" className="overflow-hidden px-4 pb-6 pt-10 sm:pb-0 sm:px-6 md:pt-16">
      <div className="mx-auto w-full max-w-[1200px] text-center">
        <p className="hero-in mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-card py-1.5 pl-2 pr-4 text-[13px] font-medium text-text-secondary" style={d(0)}>
          <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-text">New</span>
          {HERO.badge}
        </p>
        <h1 id="hero-h" className="hero-in mx-auto text-balance text-[clamp(2.2rem,7.4vw,5.4rem)] font-bold leading-[1] tracking-[-0.045em]" style={d(80)}>
          <span className="block">{HERO.title}</span> <span className="dim block">{HERO.titleDim}</span>
        </h1>
        <p className="hero-in mx-auto mt-6 max-w-lg text-balance text-[clamp(1.05rem,2vw,1.35rem)] leading-snug text-text-secondary" style={d(200)}>
          {HERO.line}
        </p>
        <div className="hero-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={d(320)}>
          <ButtonLink href="#contact" variant="accent" size="lg" className="w-full sm:w-auto">
            {HERO.primary}
          </ButtonLink>
          <ButtonLink href="#software" variant="secondary" size="lg" className="w-full sm:w-auto">
            {HERO.secondary}
            <ArrowRightIcon className="size-4" />
          </ButtonLink>
        </div>
        <ul className="hero-in mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] font-medium text-text-tertiary" style={d(440)}>
          {HERO.facts.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <i className="size-1 rounded-full bg-[#C7C7CC]" />
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mx-auto mt-10 w-full max-w-[1200px] md:mt-14">
        <HeroBackdrop />
        <div className="relative [mask-image:linear-gradient(to_bottom,#000_88%,transparent)] px-[3%] pt-[2%] sm:px-0">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
