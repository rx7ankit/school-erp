import { BellIcon, PhoneIcon, ReceiptIcon, UsersIcon } from "@/components/icons";
import { InView } from "@/components/in-view";
import { Phone } from "@/components/mockups/devices";
import { Pill } from "@/components/mockups/kit";
import { Section } from "@/components/section";
import { PARENT_HEAD, PARENT_POINTS } from "@/lib/content";

const ICONS = { bell: BellIcon, users: UsersIcon, receipt: ReceiptIcon } as const;

export function ParentApp() {
  return (
    <Section id="parents" title={PARENT_HEAD.title} line={PARENT_HEAD.line}>
      <InView className="overflow-hidden rounded-[32px] bg-card px-4 pt-10 sm:px-10 md:pt-16">
        <div className="mx-auto flex max-w-[860px] items-end justify-center">
          <InView reveal delay={200} className="relative z-0 -mr-[7%] w-[33%] origin-bottom translate-y-[8%] scale-[0.92]">
            <Phone screen="results" />
          </InView>
          <InView reveal className="relative z-10 w-[40%]">
            <div className="float" style={{ "--fs": "9s", "--fa": "-8px" } as React.CSSProperties}>
              <Phone screen="home" />
            </div>
          </InView>
          <InView reveal delay={300} className="relative z-0 -ml-[7%] w-[33%] origin-bottom translate-y-[8%] scale-[0.92]">
            <Phone screen="alerts" />
          </InView>
        </div>
      </InView>
      <ul className="mx-auto mt-10 grid max-w-[920px] gap-3 md:grid-cols-3 md:gap-5">
        {PARENT_POINTS.map((p, i) => {
          const Icon = ICONS[p.icon];
          return (
            <InView as="li" reveal delay={i * 100} key={p.title} className="flex items-start gap-4 rounded-[22px] bg-card p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-fill text-text">
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="text-[18px] font-bold tracking-[-0.01em]">{p.title}</h3>
                <p className="mt-1 text-[15px] leading-snug text-text-secondary">{p.line}</p>
              </div>
            </InView>
          );
        })}
      </ul>
      <InView reveal className="mt-8 flex items-center justify-center gap-2.5">
        {["iPhone", "Android", "Web"].map((n) => (
          <Pill key={n} className="h-11 bg-card px-5 text-[15px]">
            <PhoneIcon className="size-4 text-text-secondary" />
            {n}
          </Pill>
        ))}
      </InView>
    </Section>
  );
}
