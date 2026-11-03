import { ArrowRightIcon, AwardIcon, CalendarCheckIcon, ChatIcon, GridIcon, RupeeIcon } from "@/components/icons";
import { HeroDashboard } from "@/components/mockups/hero-dashboard";
import { Pop, Reveal, WordReveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { HERO } from "@/lib/content";

const APPS = [
  [CalendarCheckIcon, "Attendance"],
  [RupeeIcon, "Fees"],
  [AwardIcon, "Results"],
  [ChatIcon, "Messages"],
  [GridIcon, "Timetable"],
] as const;

/**
 * The glowing horizon behind the lower half of the dashboard: a blush wash, a soft white halo, a bright core line
 * with a cool tint at the left end and a warm one at the right, and a slow shimmer. Fills and gradients only.
 */
function HeroLight() {
  return (
    <Reveal on="hero" delay={900} y={0} blur={0} duration={1600} className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[62%]">
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(236,236,240,0),rgba(255,222,200,0.34)_70%,rgba(255,214,190,0.5))]" />
      <div className="absolute inset-x-[-6%] bottom-[14%] h-[240px] bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(255,255,255,0.95),rgba(255,255,255,0.55)_45%,rgba(255,255,255,0))]" />
      <div className="absolute inset-x-0 bottom-[calc(14%+119px)] h-[3px] bg-[linear-gradient(90deg,rgba(214,220,235,0),rgba(214,220,235,0.95)_12%,#fff_32%,#fff_68%,rgba(255,206,174,0.95)_88%,rgba(255,206,174,0))]" />
      <div className="light-shimmer absolute inset-x-0 bottom-[calc(14%+118px)] h-[5px] overflow-hidden">
        <i className="block h-full w-[28%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,1),transparent)]" />
      </div>
    </Reveal>
  );
}

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-h" className="relative z-0 min-h-[760px] overflow-x-clip pb-14 sm:min-h-svh sm:pb-24">
      <HeroLight />
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 pt-[100px] text-center sm:px-6 md:pt-[104px]">
        <Reveal on="hero" delay={0} y={12}>
          <p className="inline-flex items-center gap-2 rounded-full bg-bg/70 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary [filter:drop-shadow(0_2px_8px_rgba(20,20,30,0.05))]">
            <i className="size-1.5 rounded-full bg-success" />
            {HERO.badge}
          </p>
        </Reveal>
        <WordReveal
          as="h1"
          id="hero-h"
          on="hero"
          delay={140}
          title={HERO.title}
          dim={HERO.titleDim}
          className="mt-4 text-[clamp(2.3rem,5.6vw,4.6rem)] font-bold leading-[1.04] tracking-[-0.045em] [&_.dim]:text-text-tertiary"
        />
        <Reveal as="p" on="hero" delay={620} y={18} className="mx-auto mt-4 max-w-[34rem] text-balance text-[clamp(1.02rem,1.6vw,1.2rem)] leading-snug text-text-secondary">
          {HERO.line}
        </Reveal>
        <Reveal on="hero" delay={760} y={18} className="mt-6 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="#contact" variant="accent" size="lg" className="w-full sm:w-auto">
            {HERO.primary}
          </ButtonLink>
          <ButtonLink href="#software" variant="ghost" size="lg" className="w-full bg-bg/60 hover:bg-bg sm:w-auto">
            {HERO.secondary}
            <ArrowRightIcon className="size-4" />
          </ButtonLink>
        </Reveal>
        <Reveal on="hero" delay={900} y={12} className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <span className="text-[13px] font-medium text-text-tertiary">One app for</span>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {APPS.map(([Icon, label], i) => (
              <li key={label}>
                <Pop on="hero" delay={1000} i={i} stagger={85} className="flex h-9 items-center gap-2 rounded-full bg-bg px-3.5 text-[13px] font-semibold text-text [filter:drop-shadow(0_3px_8px_rgba(20,20,30,0.06))]">
                  <Icon className="size-[15px] text-text-secondary" />
                  {label}
                </Pop>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
      <div className="relative z-10 mt-9 sm:mt-10">
        <HeroDashboard />
      </div>
    </section>
  );
}
