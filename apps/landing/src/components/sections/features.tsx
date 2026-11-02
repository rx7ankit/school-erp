import type { ReactNode } from "react";
import { BellIcon, CalendarCheckIcon, ChatIcon, GridIcon, RupeeIcon, AwardIcon } from "@/components/icons";
import { InView } from "@/components/in-view";
import { Pill } from "@/components/mockups/kit";
import { AttendanceScene, FeesScene, MessagesScene, ResultsScene, TimetableScene } from "@/components/mockups/scenes";
import { Section } from "@/components/section";
import { ALSO, FEATURES, FEATURES_HEAD } from "@/lib/content";
import { cn } from "@/lib/cn";

const ICONS: Record<string, typeof BellIcon> = {
  attendance: CalendarCheckIcon,
  fees: RupeeIcon,
  results: AwardIcon,
  messages: ChatIcon,
  timetable: GridIcon,
};
const SCENES: Record<string, ReactNode> = {
  attendance: <AttendanceScene />,
  fees: <FeesScene />,
  results: <ResultsScene />,
  messages: <MessagesScene />,
  timetable: <TimetableScene />,
};

export function Features() {
  return (
    <Section id="features" title={FEATURES_HEAD.title} line={FEATURES_HEAD.line}>
      <div className="flex flex-col gap-16 md:gap-24">
        {FEATURES.map((f, i) => {
          const Icon = ICONS[f.id];
          return (
            <div key={f.id} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <InView reveal className={cn("lg:max-w-md", i % 2 === 1 && "lg:order-2 lg:justify-self-end")}>
                <span className="grid size-14 place-items-center rounded-[18px] bg-accent-subtle text-accent">
                  <Icon className="size-7" />
                </span>
                <h3 className="mt-5 text-[clamp(1.7rem,3vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.025em]">{f.title}</h3>
                <p className="mt-3 text-[18px] leading-snug text-text-secondary">{f.line}</p>
              </InView>
              <InView reveal delay={120} className="w-full">
                {SCENES[f.id]}
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
