import type { ReactNode } from "react";
import { AwardIcon, BellIcon, CheckIcon, ChatIcon, HomeIcon, ReceiptIcon, RupeeIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { IphoneFrame } from "./frames/iphone-frame";
import { MacbookFrame } from "./frames/macbook-frame";
import { Avatar, Bar, Pill, Ring, Scaled } from "./kit";

/* ======================================================================= MacBook */
/** MacBook Pro frame (supplied SVG). Design width 100.46em makes the glass exactly 82em wide. Not used in the hero any more. */
export function Laptop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Scaled design={100.46} ratio="1216 / 735" className={className}>
      <MacbookFrame className="size-full">{children}</MacbookFrame>
    </Scaled>
  );
}

/* ======================================================================= Phone */
export type PhoneScreen = "home" | "results" | "alerts";

function Tabs({ active }: { active: number }) {
  const tabs = [HomeIcon, AwardIcon, RupeeIcon, ChatIcon];
  return (
    <div className="absolute inset-x-[1.5em] bottom-[1.5em] flex items-center justify-around rounded-full bg-bg/85 p-[0.6em] backdrop-blur-xl">
      {tabs.map((T, i) => (
        <span key={i} className={cn("grid size-[3.8em] place-items-center rounded-full", i === active ? "bg-solid text-on-solid" : "text-text-tertiary")}>
          <T className="size-[1.9em]" />
        </span>
      ))}
    </div>
  );
}

function HomeScreen() {
  return (
    <>
      <div className="px-[1.7em] pt-[4.6em]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[1.15em] text-text-secondary">Good morning</div>
            <div className="text-[2em] font-bold leading-tight tracking-[-0.03em]">Mr. Mishra</div>
          </div>
          <Avatar name="Aarav Mishra" className="size-[3.6em]" />
        </div>
        <div className="mt-[1.1em] flex items-center gap-[0.6em] rounded-full bg-card p-[0.45em] text-[1.15em] font-semibold">
          <span className="rounded-full bg-solid px-[1em] py-[0.5em] text-on-solid">Aarav</span>
          <span className="px-[0.6em] text-text-secondary">Diya</span>
          <span className="ml-auto pr-[0.8em] text-text-tertiary">Class 8-B</span>
        </div>
        <div className="mt-[1.1em] flex items-center gap-[1.2em] rounded-[2.2em] bg-card p-[1.4em]">
          <Ring value={96} className="size-[7.4em]">
            <span className="text-[1.9em] font-bold">96%</span>
          </Ring>
          <div className="min-w-0">
            <div className="text-[1.1em] text-text-secondary">Attendance</div>
            <div className="text-[1.6em] font-bold leading-tight">Present today</div>
            <div className="mt-[0.7em] flex gap-[0.4em]">
              {["M", "T", "W", "T", "F"].map((d, i) => (
                <span key={i} className={cn("grid size-[2.1em] place-items-center rounded-full text-[0.95em] font-semibold", i < 4 ? "bg-solid text-on-solid" : "bg-bg text-text-tertiary")}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-[0.9em] flex items-center justify-between rounded-[2.2em] bg-card p-[1.4em]">
          <div>
            <div className="text-[1.1em] font-semibold text-text-secondary">Term 2 fee</div>
            <div className="text-[2em] font-bold leading-tight">₹1,800</div>
          </div>
          <Pill tone="white">Due 15 Nov</Pill>
        </div>
        <div className="mt-[1.1em] text-[1.4em] font-bold">Today</div>
        <ul className="mt-[0.5em] space-y-[0.5em]">
          {[
            ["8:00", "Mathematics"],
            ["8:45", "Science"],
          ].map(([t, s]) => (
            <li key={t} className="flex items-center gap-[1em] rounded-[1.6em] bg-card px-[1.2em] py-[0.8em] text-[1.25em]">
              <span className="w-[2.8em] font-semibold tabular-nums text-text-secondary">{t}</span>
              <span className="font-bold">{s}</span>
            </li>
          ))}
        </ul>
      </div>
      <Tabs active={0} />
    </>
  );
}

function ResultsScreen() {
  const rows: Array<[string, number]> = [
    ["Mathematics", 92],
    ["Science", 88],
    ["Hindi", 81],
    ["English", 90],
    ["Social Sci.", 84],
  ];
  return (
    <>
      <div className="px-[1.7em] pt-[4.6em]">
        <div className="text-[2em] font-bold leading-tight tracking-[-0.02em]">Results</div>
        <div className="text-[1.15em] text-text-secondary">Half-yearly · Class 8-B</div>
        <div className="mt-[1.1em] flex items-center gap-[1.3em] rounded-[2.2em] bg-card p-[1.4em]">
          <Ring value={87} className="size-[8em]">
            <span className="text-[2.1em] font-bold">87%</span>
          </Ring>
          <div>
            <Pill tone="dark">Grade A</Pill>
            <div className="mt-[0.6em] text-[1.5em] font-bold leading-tight">Rank 3</div>
            <div className="text-[1.1em] text-text-secondary">of 40 students</div>
          </div>
        </div>
        <ul className="mt-[1.1em] space-y-[1.1em]">
          {rows.map(([s, m], i) => (
            <li key={s}>
              <div className="mb-[0.4em] flex justify-between text-[1.25em]">
                <span className="font-semibold">{s}</span>
                <span className="font-bold tabular-nums">{m}</span>
              </div>
              <Bar pct={m} delay={400 + i * 100} color={m === 92 ? "bg-accent" : "bg-[#2a2a2c]"} />
            </li>
          ))}
        </ul>
      </div>
      <Tabs active={1} />
    </>
  );
}

function AlertsScreen() {
  const items: Array<[typeof BellIcon, string, string, string]> = [
    [CheckIcon, "Attendance", "Aarav is present today", "9:58 am"],
    [ReceiptIcon, "Fee reminder", "Term 2 fee of ₹1,800 due 15 Nov", "8:30 am"],
    [AwardIcon, "Results", "Half-yearly results are published", "Yesterday"],
    [ChatIcon, "Mathematics", "Chapter 7 test on Wednesday", "Yesterday"],
  ];
  return (
    <>
      <div className="px-[1.7em] pt-[4.6em]">
        <div className="text-[2em] font-bold leading-tight tracking-[-0.02em]">Alerts</div>
        <ul className="mt-[1.1em] space-y-[0.7em]">
          {items.map(([I, t, b, w], i) => (
            <li key={t} className="flex gap-[1em] rounded-[2em] bg-card p-[1.2em]">
              <span className={cn("grid size-[3.6em] shrink-0 place-items-center rounded-full", i === 0 ? "bg-solid text-on-solid" : "bg-bg text-text-secondary")}>
                <I className="size-[1.8em]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex justify-between text-[1.1em] text-text-secondary">
                  <span className="font-semibold">{t}</span>
                  <span>{w}</span>
                </span>
                <span className="mt-[0.2em] block text-[1.3em] font-bold leading-snug">{b}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <Tabs active={3} />
    </>
  );
}

/** iPhone frame (supplied SVG). Design width 29.17em makes the screen 26em wide; the UI starts below the Dynamic Island. */
export function Phone({ screen = "home", className }: { screen?: PhoneScreen; className?: string }) {
  return (
    <Scaled design={29.17} ratio="460 / 962" className={className}>
      <IphoneFrame className="size-full">
        <div className="absolute inset-x-0 top-0 z-[5] flex items-center justify-between px-[2.6em] pt-[0.6em] text-[1.1em] font-semibold tabular-nums">
          <span>9:41</span>
          <span className="flex items-end gap-[0.2em]">
            {[0.5, 0.75, 1, 1.25].map((h) => (
              <i key={h} className="w-[0.35em] rounded-full bg-text" style={{ height: `${h}em` }} />
            ))}
          </span>
        </div>
        {screen === "home" ? <HomeScreen /> : screen === "results" ? <ResultsScreen /> : <AlertsScreen />}
        <i className="absolute inset-x-0 bottom-[0.5em] z-10 mx-auto h-[0.35em] w-[9em] rounded-full bg-solid/80" />
        {/* faint glass reflection */}
        <div className="pointer-events-none absolute inset-0 z-20 [background:linear-gradient(118deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_26%,rgba(255,255,255,0)_46%)]" />
      </IphoneFrame>
    </Scaled>
  );
}
