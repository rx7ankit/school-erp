import { ArrowRightIcon, PhoneIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { HERO } from "@/lib/content";
import { HeroBackdrop } from "@/components/art/hero-backdrop";
import { HeroVisual } from "@/components/mockups/devices";

export function Hero() {
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
  return (
    <section id="top" aria-labelledby="hero-h" className="overflow-hidden px-4 pb-6 pt-10 sm:px-6 md:pb-10 md:pt-16">
      <div className="mx-auto w-full max-w-[1200px] text-center">
        <h1 id="hero-h" className="hero-in mx-auto max-w-[14ch] text-balance text-[clamp(2.5rem,6.6vw,4.9rem)] font-bold leading-[1.02] tracking-[-0.035em]" style={d(0)}>
          {HERO.title} <span className="dim">{HERO.titleDim}</span>
        </h1>
        <p className="hero-in mx-auto mt-5 max-w-lg text-balance text-[clamp(1.1rem,2vw,1.4rem)] leading-snug text-text-secondary" style={d(120)}>
          {HERO.line}
        </p>
        <div className="hero-in mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={d(220)}>
          <ButtonLink href="#contact" variant="accent" size="lg" className="w-full sm:w-auto">
            {HERO.primary}
          </ButtonLink>
          <ButtonLink href="#features" variant="secondary" size="lg" className="w-full sm:w-auto">
            {HERO.secondary}
            <ArrowRightIcon className="size-4" />
          </ButtonLink>
        </div>
        <ul className="hero-in mt-6 flex items-center justify-center gap-5 text-[14px] font-semibold text-text-secondary" style={d(320)}>
          {HERO.facts.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <PhoneIcon className="size-4" />
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mx-auto mt-10 w-full max-w-[1200px] md:mt-16">
        <HeroBackdrop />
        <div className="relative px-[3%] pt-[3%] sm:px-0 sm:pt-[5%]">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
