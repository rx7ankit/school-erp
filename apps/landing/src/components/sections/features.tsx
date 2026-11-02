import { FEATURE_ICONS, featureScene } from "@/components/feature-assets";
import { InView } from "@/components/in-view";
import { Pill } from "@/components/mockups/kit";
import { TwoTone } from "@/components/section-heading";
import { Section } from "@/components/section";
import { ALSO, FEATURES, SOFTWARE_HEAD } from "@/lib/content";
import { cn } from "@/lib/cn";

export function Features() {
  return (
    <Section id="software" title={SOFTWARE_HEAD.title} dim={SOFTWARE_HEAD.dim} line={SOFTWARE_HEAD.line}>
      <div className="flex flex-col gap-16 md:gap-24">
        {FEATURES.map((f, i) => {
          const Icon = FEATURE_ICONS[f.id];
          return (
            <div key={f.id} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <InView reveal className={cn("lg:max-w-md", i % 2 === 1 && "lg:order-2 lg:justify-self-end")}>
                <span className="grid size-14 place-items-center rounded-[18px] bg-card text-text">
                  <Icon className="size-7" />
                </span>
                <h3 className="mt-5 text-[clamp(1.7rem,3vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.025em]">
                  <TwoTone title={f.title} dim={f.dim} />
                </h3>
                <p className="mt-3 text-[18px] leading-snug text-text-secondary">{f.line}</p>
              </InView>
              <InView reveal delay={120} className="w-full">
                {featureScene(f.id)}
              </InView>
            </div>
          );
        })}
      </div>
      <InView reveal className="mt-16 flex flex-wrap items-center justify-center gap-2.5 md:mt-24">
        <span className="mr-1 w-full text-center text-[15px] font-semibold text-text-secondary sm:w-auto">Also included</span>
        {ALSO.map((a) => (
          <Pill key={a} className="h-10 bg-card px-4 text-[14px]">
            {a}
          </Pill>
        ))}
      </InView>
    </Section>
  );
}
