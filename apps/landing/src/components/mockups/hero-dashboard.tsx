"use client";

import type { CSSProperties, ReactNode } from "react";
import { AwardIcon, BellIcon, CalendarCheckIcon, CheckIcon, ChatIcon, GridIcon, HomeIcon, ReceiptIcon, RupeeIcon, UsersIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { CountUp, Parallax, Pop, Reveal } from "@/components/motion";
import { usePresent } from "@/components/present/present-provider";
import { cn } from "@/lib/cn";
import { Area, Avatar, Bar } from "./kit";

/**
 * Hero visual: a flat school dashboard that pops up out of the page. No device chrome, no outline, flat fills only.
 * Design width is 100em (1em = 1% of the stage), so the same markup scales from a phone to a wide desktop.
 * It rises from the bottom of the viewport when the hero reveal starts (`html[data-hero="go"]`); the hero section crops it.
 * A dark glass "demo" pill sits on it (starts the presentation deck) and two small flat cards pop in after it and float.
 */

const SIDE = [
  [HomeIcon, "Dashboard"],
  [CalendarCheckIcon, "Attendance"],
  [UsersIcon, "Students"],
  [RupeeIcon, "Fees"],
  [AwardIcon, "Results"],
  [ChatIcon, "Messages"],
  [GridIcon, "Timetable"],
] as const;

const PERIODS = [
  ["8:00", "Mathematics", "Class 8-B · Mr. Dubey", "Now"],
  ["8:45", "Science", "Class 7-A · Mrs. Rai", "45 min"],
  ["9:30", "Hindi", "Class 9-C · Mr. Mishra", "45 min"],
  ["10:15", "English", "Class 6-A · Ms. Kapoor", "45 min"],
] as const;

const FEED = [
  ["RS", "Receipt R-2041 issued", "₹1,800 · Priya Shukla", "10:21", "bg-success"],
  ["8B", "8-B attendance marked", "38 of 40 present", "9:58", "bg-success"],
  ["9A", "Results published", "Class 9-A · Half-yearly", "Yesterday", "bg-[#C7C7CC]"],
] as const;

/* Soft grey tile used for every card inside the panel. */
const TILE = "rounded-[2.2em] bg-[#F6F6F8]";
const LABEL = "text-[1.15em] font-medium text-text-secondary";

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function Delta({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-[0.4em] rounded-full bg-success/[0.09] px-[0.8em] py-[0.25em] text-[1em] font-semibold tabular-nums text-success">{children}</span>;
}

/** Row of fine ticks, a share of them filled: reads as a quiet attendance meter. */
function Ticks({ filled, total = 36 }: { filled: number; total?: number }) {
  return (
    <div className="flex h-[2.4em] items-end gap-[0.28em]">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={cn("flex-1 rounded-full", i < filled ? "h-full bg-solid" : "h-[60%] bg-[#DCDCE1]")} />
      ))}
    </div>
  );
}

function Panel() {
  return (
    <div className="flex size-full overflow-hidden rounded-[28px] bg-bg text-text [font-variant-numeric:tabular-nums]">
      {/* sidebar */}
      <aside className="flex w-[17em] shrink-0 flex-col bg-[#FAFAFB] px-[1.6em] pb-[1.8em] pt-[2em]">
        <div className="flex items-center gap-[0.9em] px-[0.8em]">
          <LogoMark className="size-[2.7em]" />
          <span className="text-[1.9em] font-bold tracking-[-0.04em]">Krevo</span>
        </div>
        <div className="mt-[2em] flex items-center gap-[0.9em] rounded-[1.4em] bg-[#F2F2F5] p-[0.9em]">
          <span className="grid size-[2.8em] place-items-center rounded-[0.9em] bg-bg text-[1.1em] font-bold">S</span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[1.1em] font-semibold">Sunrise Public</span>
            <span className="block text-[0.95em] text-text-tertiary">448 students</span>
          </span>
        </div>
        <ul className="mt-[1.6em] space-y-[0.2em]">
          {SIDE.map(([Icon, label], i) => (
            <li key={label} className={cn("flex h-[3.5em] items-center gap-[1em] rounded-[1.2em] px-[1.1em] text-[1.2em]", i === 0 ? "bg-bg font-semibold text-text" : "font-medium text-text-secondary")}>
              <Icon className={cn("size-[1.3em]", i === 0 ? "text-text" : "text-text-tertiary")} />
              <span className="flex-1">{label}</span>
              {i === 5 ? <span className="grid h-[1.6em] min-w-[1.6em] place-items-center rounded-full bg-solid px-[0.4em] text-[0.8em] font-semibold text-on-solid">3</span> : null}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center gap-[0.9em] px-[0.6em]">
          <Avatar name="Meera Tripathi" tone="dark" className="size-[3em]" />
          <div className="min-w-0 text-[1.05em] leading-tight">
            <div className="font-semibold">Mrs. Tripathi</div>
            <div className="text-text-tertiary">Principal</div>
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col gap-[2em] px-[3em] pb-[2.4em] pt-[2.2em]">
        {/* command bar */}
        <div className="flex items-center gap-[1.4em]">
          <div className="flex h-[4.2em] w-[38em] items-center gap-[1em] rounded-full bg-[#F4F4F6] pl-[1.5em] pr-[0.9em]">
            <SearchGlyph className="size-[1.5em] text-text-tertiary" />
            <span className="flex-1 text-[1.2em] text-text-tertiary">Search students, receipts, classes</span>
            <kbd className="rounded-[0.8em] bg-bg px-[0.8em] py-[0.35em] font-sans text-[1.05em] font-semibold text-text-secondary">⌘K</kbd>
          </div>
          <span className="ml-auto flex items-center gap-[0.7em] rounded-full bg-[#F4F4F6] px-[1.2em] py-[0.8em] text-[1.1em] font-medium text-text-secondary">
            <i className="relative size-[0.7em] rounded-full bg-success" />
            Term 2 · Week 5
          </span>
          <span className="relative grid size-[4.2em] place-items-center rounded-full bg-[#F4F4F6]">
            <BellIcon className="size-[1.7em] text-text-secondary" />
            <i className="absolute right-[1.15em] top-[1.1em] size-[0.8em] rounded-full bg-solid" />
          </span>
        </div>

        {/* greeting */}
        <div>
          <div className="text-[2.9em] font-bold leading-[1.1] tracking-[-0.045em]">Good morning, Mrs. Tripathi</div>
          <div className="mt-[0.5em] text-[1.25em] text-text-secondary">Monday, 2 November · 3 things need you today</div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-[1.4em]">
          <div className={cn(TILE, "p-[1.9em]")}>
            <div className="flex items-center justify-between">
              <span className={LABEL}>Present today</span>
              <Delta>+1.2%</Delta>
            </div>
            <div className="mt-[0.7em] flex items-baseline gap-[0.5em]">
              <span className="text-[3.6em] font-bold leading-none tracking-[-0.045em]">
                <CountUp to={423} on="hero" delay={1100} />
              </span>
              <span className="text-[1.3em] font-medium text-text-tertiary">/ 448</span>
            </div>
            <div className="mt-[1.6em]">
              <Ticks filled={34} />
            </div>
          </div>
          <div className={cn(TILE, "p-[1.9em]")}>
            <div className="flex items-center justify-between">
              <span className={LABEL}>Fees collected</span>
              <Delta>+8%</Delta>
            </div>
            <div className="mt-[0.7em] text-[3.6em] font-bold leading-none tracking-[-0.045em]">
              <CountUp prefix="₹" to={18400} on="hero" delay={1250} />
            </div>
            <Area className="mt-[1em] h-[4em]" points={[26, 40, 34, 56, 48, 70, 62, 90]} hi={7} />
          </div>
          <div className={cn(TILE, "p-[1.9em]")}>
            <div className="flex items-center justify-between">
              <span className={LABEL}>Pending dues</span>
              <span className="inline-flex items-center gap-[0.5em] text-[1em] font-medium text-text-tertiary">
                <i className="size-[0.6em] rounded-full bg-[#C7C7CC]" />
                62 students
              </span>
            </div>
            <div className="mt-[0.7em] text-[3.6em] font-bold leading-none tracking-[-0.045em]">
              <CountUp prefix="₹" to={42600} on="hero" delay={1400} />
            </div>
            <div className="mt-[1.9em]">
              <Bar pct={38} color="bg-solid" delay={900} className="h-[0.6em]" />
              <div className="mt-[0.9em] flex justify-between text-[1em] font-medium text-text-tertiary">
                <span>38% of term fees</span>
                <span>Due 15 Nov</span>
              </div>
            </div>
          </div>
        </div>

        {/* timetable and activity */}
        <div className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-[1.4em]">
          <div className={cn(TILE, "p-[1.9em]")}>
            <div className="flex items-center justify-between">
              <span className="text-[1.6em] font-bold tracking-[-0.02em]">Today&apos;s timetable</span>
              <span className="text-[1.05em] font-medium text-text-tertiary">Period 1 of 6</span>
            </div>
            <ul className="mt-[1.1em] space-y-[0.3em]">
              {PERIODS.map(([t, s, c, tag], i) => (
                <li key={t} className={cn("flex items-center gap-[1.2em] rounded-[1.4em] px-[1.2em] py-[0.85em]", i === 0 && "bg-bg")}>
                  <span className="w-[3.4em] text-[1.2em] font-semibold text-text-secondary">{t}</span>
                  <i className={cn("size-[0.7em] shrink-0 rounded-full", i === 0 ? "bg-success" : "bg-[#C7C7CC]")} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[1.35em] font-semibold tracking-[-0.01em]">{s}</span>
                    <span className="block text-[1.05em] text-text-secondary">{c}</span>
                  </span>
                  {i === 0 ? (
                    <span className="inline-flex items-center gap-[0.6em] rounded-full bg-solid px-[1.1em] py-[0.45em] text-[1.05em] font-semibold text-on-solid">
                      <i className="dotblink size-[0.55em] rounded-full bg-on-solid" />
                      Now
                    </span>
                  ) : (
                    <span className="text-[1.05em] font-medium text-text-tertiary">{tag}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className={cn(TILE, "p-[1.9em]")}>
            <div className="flex items-center justify-between">
              <span className="text-[1.6em] font-bold tracking-[-0.02em]">Activity</span>
              <span className="text-[1.05em] font-medium text-text-tertiary">View all</span>
            </div>
            <ul className="mt-[1.4em] space-y-[1.3em]">
              {FEED.map(([ini, t, s, when, dot]) => (
                <li key={t} className="flex items-center gap-[1.1em]">
                  <span className="relative">
                    <span className="grid size-[3.4em] place-items-center rounded-full bg-[linear-gradient(150deg,#F7F7F9,#D6D6DC)] text-[1.05em] font-semibold text-text-secondary">{ini}</span>
                    <i className={cn("absolute -bottom-[0.05em] -right-[0.05em] size-[1em] rounded-full border-[0.2em] border-[#F6F6F8]", dot)} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[1.25em] font-semibold tracking-[-0.01em]">{t}</span>
                    <span className="block truncate text-[1.05em] text-text-secondary">{s}</span>
                  </span>
                  <span className="text-[1em] font-medium text-text-tertiary">{when}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Flat pop-up cards. Elevation is a drop-shadow filter on the card, never a box-shadow. */
const CARD = "w-max rounded-[2em] bg-bg p-[1.4em] text-text [filter:drop-shadow(0_18px_28px_rgba(20,20,30,0.09))_drop-shadow(0_2px_4px_rgba(20,20,30,0.06))]";

/** Pop-in wrapper > float wrapper > card. Each layer owns one transform; the parallax wrapper outside owns the scroll drift. */
function Floating({ n, speed, delay, className, par, children }: { n: number; speed: number; delay: number; className: string; par: number; children: ReactNode }) {
  return (
    <Parallax origin="top" speed={par} className={cn("absolute z-10 max-sm:hidden", className)}>
      <Pop on="hero" delay={delay}>
        <div className="float" style={{ "--fs": `${speed}s`, "--fa": "-6px", "--fd": `-${n * 2.3}s` } as CSSProperties}>
          {children}
        </div>
      </Pop>
    </Parallax>
  );
}

function NotifyCard() {
  return (
    <div className={cn(CARD, "flex items-center gap-[1.2em] pr-[1.8em]")}>
      <span className="relative">
        <Avatar name="Aarav Mishra" tone="dark" className="size-[4em]" />
        <i className="absolute -bottom-[0.1em] -right-[0.1em] grid size-[1.7em] place-items-center rounded-full border-[0.25em] border-bg bg-success text-on-solid">
          <CheckIcon className="size-[0.95em]" strokeWidth={3} />
        </i>
      </span>
      <div className="leading-tight">
        <div className="text-[1.45em] font-semibold tracking-[-0.02em]">Aarav is present</div>
        <div className="mt-[0.2em] flex items-center gap-[0.6em] text-[1.1em] text-text-secondary">
          <BellIcon className="size-[1em]" />
          Parent notified · now
        </div>
      </div>
    </div>
  );
}

function FeeCard() {
  return (
    <div className={cn(CARD, "flex items-center gap-[1.2em] pr-[1.8em]")}>
      <span className="grid size-[4em] place-items-center rounded-[1.3em] bg-[#F2F2F5]">
        <ReceiptIcon className="size-[1.9em]" />
      </span>
      <div className="leading-tight">
        <div className="flex items-baseline gap-[0.7em]">
          <span className="text-[1.45em] font-semibold tracking-[-0.02em]">Fee received</span>
          <span className="text-[1.05em] font-medium text-text-tertiary">10:21</span>
        </div>
        <div className="mt-[0.2em] text-[1.1em] text-text-secondary">
          <b className="font-semibold text-text">₹1,800</b> · Priya Shukla
        </div>
      </div>
    </div>
  );
}

/** Dark glass pill floating on the dashboard. Starts the presentation deck from its own position (same as pressing P). */
function DemoPill() {
  const { start } = usePresent();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[13cqw] z-20 flex justify-center max-sm:top-[24cqw]">
      <Pop on="hero" delay={2050} className="pointer-events-auto">
        <button
          type="button"
          onClick={(e) => start(e.currentTarget)}
          aria-label="See Krevo in 2 minutes: start the slide deck (P)"
          className="group flex h-[52px] items-center gap-3 rounded-full bg-[#1D1D1F]/80 py-1.5 pl-1.5 pr-4 text-[15px] font-semibold tracking-[-0.01em] text-on-solid backdrop-blur-xl backdrop-saturate-150 [filter:drop-shadow(0_14px_26px_rgba(20,20,30,0.28))] hover:bg-[#1D1D1F]/90 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span className="grid size-10 place-items-center rounded-full bg-on-solid/95 text-text transition-transform duration-300 group-hover:scale-105">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="ml-0.5 size-4 fill-current">
              <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8Z" />
            </svg>
          </span>
          See Krevo in 2 minutes
          <kbd className="hidden h-6 min-w-6 place-items-center rounded-md bg-on-solid/15 px-1.5 font-sans text-[12px] font-semibold text-on-solid/80 md:grid">P</kbd>
        </button>
      </Pop>
    </div>
  );
}

/**
 * The whole visual. Layout contract: the parent (hero section) is `overflow-hidden` with a fixed height, so the panel is
 * cropped by the bottom of the first viewport on desktop. On phones it is a 600px-wide stage centred in a 300px-tall window.
 */
export function HeroDashboard() {
  return (
    <div data-hero-ui className="relative mx-auto w-full px-3 sm:px-0">
      <div className="relative mx-auto w-full [container-type:inline-size] sm:w-[min(1080px,calc(100%-2rem))]">
        <div className="relative [font-size:calc(100cqw/100)]">
          <Parallax origin="top" speed={-0.05} className="relative">
            <Reveal on="hero" delay={750} y={150} blur={0} duration={1150}>
              <div aria-hidden="true" className="select-none [filter:drop-shadow(0_30px_50px_rgba(20,20,30,0.10))_drop-shadow(0_2px_6px_rgba(20,20,30,0.05))]">
                <div style={{ aspectRatio: "100 / 68" }}>
                  <Panel />
                </div>
              </div>
            </Reveal>
            <DemoPill />
          </Parallax>
          <div aria-hidden="true" className="select-none">
            <Floating n={0} speed={8} delay={1800} par={-0.12} className="right-[-5em] top-[4em]">
              <NotifyCard />
            </Floating>
            <Floating n={1} speed={9} delay={2000} par={-0.2} className="left-[-5em] top-[15em]">
              <FeeCard />
            </Floating>
          </div>
        </div>
      </div>
    </div>
  );
}
