import type { ReactNode } from "react";
import { AwardIcon, BellIcon, CalendarCheckIcon, CheckIcon, ChatIcon, ClockIcon, GridIcon, HomeIcon, ReceiptIcon, RupeeIcon, UsersIcon } from "@/components/icons";
import { CountUp, InView, Tilt } from "@/components/in-view";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/cn";
import { Area, Avatar, Bar, Chip, Pill, Ring, Scaled, Tile } from "./kit";

/* ======================================================================= Browser dashboard */
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
  ["8:00", "Mathematics", "Class 8-B · Mr. Dubey", true],
  ["8:45", "Science", "Class 7-A · Mrs. Rai", false],
  ["9:30", "Hindi", "Class 9-C · Mr. Mishra", false],
] as const;

/** The school dashboard UI. Fills whatever screen it is placed in (design width 82em). */
export function DashboardUI() {
  return (
    <div className="flex size-full flex-col overflow-hidden bg-bg">
        <div className="flex min-h-0 flex-1">
          {/* sidebar */}
          <aside className="flex w-[14.5em] shrink-0 flex-col bg-[#F7F7F9] px-[1.3em] pb-[1.6em] pt-[1.2em]">
            <div className="flex items-center gap-[0.8em] px-[0.6em]">
              <LogoMark className="size-[2.6em]" />
              <span className="text-[1.7em] font-bold tracking-[-0.03em]">Krevo</span>
            </div>
            <ul className="mt-[1.8em] space-y-[0.3em]">
              {SIDE.map(([Icon, label], i) => (
                <li key={label} className={cn("flex h-[3.3em] items-center gap-[0.9em] rounded-[1.1em] px-[0.9em] text-[1.25em]", i === 0 ? "bg-bg font-semibold text-text" : "font-medium text-text-secondary")}>
                  <Icon className={cn("size-[1.35em]", i === 0 && "text-text")} />
                  {label}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex items-center gap-[0.8em] px-[0.6em]">
              <Avatar name="Meera Tripathi" tone="dark" className="size-[2.8em]" />
              <div className="min-w-0 text-[1.1em] leading-tight">
                <div className="font-bold">Mrs. Tripathi</div>
                <div className="text-text-secondary">Principal</div>
              </div>
            </div>
          </aside>
          {/* main */}
          <div className="flex min-w-0 flex-1 flex-col gap-[1.3em] bg-bg px-[2.1em] py-[1.9em]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[2.3em] font-bold leading-tight tracking-[-0.035em]">Good morning, Mrs. Tripathi</div>
                <div className="mt-[0.2em] text-[1.2em] text-text-secondary">Monday, 2 November</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-[1.1em]">
              <div className="flex items-center gap-[1.2em] rounded-[1.9em] bg-card p-[1.4em]">
                <Ring value={94} className="size-[7.6em]">
                  <span className="text-[1.9em] font-bold">94%</span>
                </Ring>
                <div>
                  <div className="text-[1.15em] text-text-secondary">Present today</div>
                  <div className="text-[2.2em] font-bold leading-tight">
                    <CountUp to={423} />
                  </div>
                  <div className="text-[1.1em] text-text-secondary">of 448</div>
                </div>
              </div>
              <div className="rounded-[1.9em] bg-card p-[1.4em]">
                <div className="text-[1.15em] text-text-secondary">Fees today</div>
                <div className="text-[2.7em] font-bold leading-tight tracking-[-0.02em]">
                  <CountUp prefix="₹" to={18400} />
                </div>
                <Area className="mt-[0.5em] h-[3.4em]" points={[30, 45, 38, 62, 52, 78, 70, 92]} hi={7} />
              </div>
              <div className="rounded-[1.9em] bg-card p-[1.4em]">
                <div className="text-[1.15em] text-text-secondary">Pending dues</div>
                <div className="text-[2.7em] font-bold leading-tight tracking-[-0.02em]">
                  <CountUp prefix="₹" to={42600} />
                </div>
                <div className="mt-[0.8em] text-[1.1em] text-text-secondary">62 students</div>
                <Bar pct={38} className="mt-[0.7em]" color="bg-solid" delay={700} />
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-[1.1em]">
              <div className="rounded-[1.9em] bg-card p-[1.4em]">
                <div className="flex items-center justify-between">
                  <span className="text-[1.5em] font-bold">Today&apos;s timetable</span>
                  <ClockIcon className="size-[1.6em] text-text-tertiary" />
                </div>
                <ul className="mt-[0.9em] space-y-[0.6em]">
                  {PERIODS.map(([t, s, c, now]) => (
                    <li key={t} className={cn("flex items-center gap-[1em] rounded-[1.3em] px-[1em] py-[0.7em]", now ? "bg-bg" : "")}>
                      <span className="w-[3.6em] text-[1.2em] font-semibold tabular-nums text-text-secondary">{t}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[1.35em] font-bold leading-tight">{s}</span>
                        <span className="block text-[1.05em] text-text-secondary">{c}</span>
                      </span>
                      {now ? <Pill tone="dark">Now</Pill> : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[1.9em] bg-card p-[1.4em]">
                <span className="text-[1.5em] font-bold">Activity</span>
                <ul className="mt-[0.9em] space-y-[0.9em]">
                  {[
                    [ReceiptIcon, "Receipt R-2041", "₹1,800 · 10:21"],
                    [CheckIcon, "8-B attendance", "Marked · 9:58"],
                    [BellIcon, "Results published", "Class 9-A · Yesterday"],
                  ].map(([Icon, t, s]) => {
                    const I = Icon as typeof BellIcon;
                    return (
                      <li key={t as string} className="flex items-center gap-[0.9em]">
                        <Tile tone="white" className="size-[3em]">
                          <I className="size-[1.5em]" />
                        </Tile>
                        <span className="min-w-0">
                          <span className="block text-[1.3em] font-bold leading-tight">{t as string}</span>
                          <span className="block text-[1.05em] text-text-secondary">{s as string}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

/* ======================================================================= MacBook */
/**
 * MacBook Pro 14 style frame, drawn as inline SVG (no external asset). The screen is an exact rectangle
 * (4.2% / 1.86%, 91.6% x 92.25%) filled by `children`. Design width 89.5em makes the screen 82em wide.
 */
export function Laptop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Scaled design={89.5} ratio="1000 / 645" className={className}>
      <div className="relative size-full">
        <svg viewBox="0 0 1000 645" className="absolute inset-0 size-full overflow-visible" focusable="false">
          <defs>
            <linearGradient id="mb-rim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E9E9EC" />
              <stop offset="0.5" stopColor="#B4B4BA" />
              <stop offset="1" stopColor="#9C9CA2" />
            </linearGradient>
            <linearGradient id="mb-lid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1d1d20" />
              <stop offset="1" stopColor="#09090a" />
            </linearGradient>
            <linearGradient id="mb-base" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ECECEF" />
              <stop offset="0.45" stopColor="#D5D5DA" />
              <stop offset="1" stopColor="#BEBEC4" />
            </linearGradient>
            <linearGradient id="mb-baseh" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#6c6c72" stopOpacity="0.55" />
              <stop offset="0.05" stopColor="#6c6c72" stopOpacity="0" />
              <stop offset="0.35" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.95" stopColor="#6c6c72" stopOpacity="0" />
              <stop offset="1" stopColor="#6c6c72" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="mb-scoop" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9d9da3" />
              <stop offset="1" stopColor="#d9d9dd" />
            </linearGradient>
            <linearGradient id="mb-hinge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" stopOpacity="0.5" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </linearGradient>
            <filter id="mb-blur" x="-10%" y="-200%" width="120%" height="500%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>
          {/* ground shadow */}
          <ellipse cx="500" cy="644" rx="470" ry="13" fill="#1b1530" opacity="0.38" filter="url(#mb-blur)" />
          {/* aluminium base, seen edge-on */}
          <path d="M2 621H998Q1000 621 1000 624L995 640Q993 645 986 645H14Q7 645 5 640L0 624Q0 621 2 621Z" fill="url(#mb-base)" />
          <path d="M2 621H998Q1000 621 1000 624L995 640Q993 645 986 645H14Q7 645 5 640L0 624Q0 621 2 621Z" fill="url(#mb-baseh)" />
          <path d="M415 621Q500 641 585 621Z" fill="url(#mb-scoop)" />
          <rect x="30" y="621" width="940" height="6" fill="url(#mb-hinge)" />
          <path d="M6 643.6Q9 644.4 14 644.4H986Q991 644.4 994 643.6" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.8" />
          {/* lid: aluminium rim, black bezel */}
          <path d="M30 24Q30 0 54 0H946Q970 0 970 24V611Q970 621 960 621H40Q30 621 30 611Z" fill="url(#mb-rim)" />
          <path d="M31.6 24.5Q31.6 1.6 54.5 1.6H945.5Q968.4 1.6 968.4 24.5V610.5Q968.4 619.4 959.5 619.4H40.5Q31.6 619.4 31.6 610.5Z" fill="url(#mb-lid)" />
          <rect x="42" y="12" width="916" height="595" rx="8" fill="#000" />
        </svg>
        <div
          className="absolute overflow-hidden rounded-[0.72em] bg-bg"
          style={{ left: "4.2%", top: "1.86%", width: "91.6%", height: "92.25%" }}
        >
          {children}
          {/* faint glass reflection */}
          <div className="pointer-events-none absolute inset-0 z-10 [background:linear-gradient(115deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.035)_24%,rgba(255,255,255,0)_44%)]" />
        </div>
        <svg viewBox="0 0 1000 645" className="pointer-events-none absolute inset-0 size-full overflow-visible" focusable="false">
          <defs>
            <radialGradient id="mb-lens" cx="0.35" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#3b4a66" />
              <stop offset="0.5" stopColor="#10141d" />
              <stop offset="1" stopColor="#050506" />
            </radialGradient>
          </defs>
          {/* notch + camera */}
          <path d="M448 12H552V22Q552 32 542 32H458Q448 32 448 22Z" fill="#000" />
          <circle cx="500" cy="22" r="3.2" fill="url(#mb-lens)" />
          <circle cx="500" cy="22" r="3.2" fill="none" stroke="#2a2a30" strokeWidth="0.6" />
          <circle cx="514" cy="22" r="1.4" fill="#0b1f12" />
          {/* top specular */}
          <path d="M54 0.6H946" stroke="#fff" strokeOpacity="0.7" strokeWidth="1" />
        </svg>
      </div>
    </Scaled>
  );
}

export function LaptopDashboard({ className }: { className?: string }) {
  return (
    <Laptop className={className}>
      <DashboardUI />
    </Laptop>
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

export type PhoneFinish = "natural" | "black";

/** Metal gradients per finish: [band top, band mid, band bottom, button light, button dark]. */
const FINISH = {
  natural: ["#E4E4E7", "#A8A8AD", "#D9D9DC", "#E9E9EC", "#8E8E93"],
  black: ["#58585d", "#27272a", "#4a4a4f", "#5d5d62", "#202023"],
} as const;

/**
 * iPhone 16 Pro style frame drawn as inline SVG (no external asset): titanium band, black bezel, side buttons.
 * The screen is an exact rectangle (0.86em inset) filled by the app UI. Design width 28em.
 */
export function Phone({ screen = "home", className, finish = "natural" }: { screen?: PhoneScreen; className?: string; finish?: PhoneFinish }) {
  const [top, mid, bot, bl, bd] = FINISH[finish];
  const id = `ph-${finish}`;
  return (
    <Scaled design={28} ratio="24 / 49" className={className}>
      <div className="relative size-full">
        <svg viewBox="0 0 280 572" className="absolute inset-0 size-full overflow-visible" focusable="false">
          <defs>
            <linearGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={top} />
              <stop offset="0.12" stopColor={bot} />
              <stop offset="0.5" stopColor={mid} />
              <stop offset="0.9" stopColor={bot} />
              <stop offset="1" stopColor={top} />
            </linearGradient>
            <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity={finish === "natural" ? 0.55 : 0.22} />
              <stop offset="0.03" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.97" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#fff" stopOpacity={finish === "natural" ? 0.55 : 0.22} />
            </linearGradient>
            <linearGradient id={`${id}-btn`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={bd} />
              <stop offset="0.5" stopColor={bl} />
              <stop offset="1" stopColor={bd} />
            </linearGradient>
          </defs>
          {/* side buttons: action + volume (left), power + camera control (right) */}
          <g fill={`url(#${id}-btn)`}>
            <rect x="-2.6" y="98" width="3.6" height="22" rx="1.6" />
            <rect x="-2.6" y="146" width="3.6" height="40" rx="1.6" />
            <rect x="-2.6" y="196" width="3.6" height="40" rx="1.6" />
            <rect x="279" y="168" width="3.6" height="66" rx="1.6" />
            <rect x="279.6" y="300" width="2.8" height="36" rx="1.4" />
          </g>
          {/* titanium band */}
          <rect width="280" height="572" rx="42" fill={`url(#${id}-band)`} />
          <rect width="280" height="572" rx="42" fill={`url(#${id}-sheen)`} />
          <rect x="0.5" y="0.5" width="279" height="571" rx="41.5" fill="none" stroke="#fff" strokeOpacity={finish === "natural" ? 0.6 : 0.18} />
          <rect x="3" y="3" width="274" height="566" rx="39" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.8" />
          {/* black bezel */}
          <rect x="3.6" y="3.6" width="272.8" height="564.8" rx="38.4" fill="#050506" />
          <rect x="3.9" y="3.9" width="272.2" height="564.2" rx="38.1" fill="none" stroke="#2c2c30" strokeWidth="0.6" />
        </svg>
        {/* screen */}
        <div className="absolute left-[0.86em] top-[0.86em] h-[55.48em] w-[26.28em] overflow-hidden rounded-[3.3em] bg-bg">
          <div className="absolute left-1/2 top-[0.75em] z-10 h-[2.4em] w-[8.4em] -translate-x-1/2 rounded-full bg-black">
            <i className="absolute right-[0.85em] top-1/2 size-[0.8em] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#34425e,#0b0e16_70%)]" />
          </div>
          <div className="absolute inset-x-0 top-0 z-[5] flex items-center justify-between px-[2.6em] pt-[1.35em] text-[1.1em] font-semibold tabular-nums">
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
        </div>
      </div>
    </Scaled>
  );
}

/* ======================================================================= Hero composition */
/** Laptop and phone layered over the hero canvas: the laptop runs past its bottom edge, the phone past its top. */
export function HeroVisual() {
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
  return (
    <InView className="relative mx-auto w-full max-w-[1120px] [container-type:inline-size] aspect-[50/62] sm:aspect-[84/56]">
      <div aria-hidden="true" className="absolute inset-0 select-none [font-size:calc(100cqw/50)] sm:[font-size:calc(100cqw/84)]">
        <Tilt className="absolute inset-0" max={1.2}>
          <div className="hero-in absolute left-[0.5em] top-[31em] w-[44em] sm:left-[1em] sm:top-[9em] sm:w-[68em]" style={d(300)}>
            <LaptopDashboard />
          </div>
          <div className="hero-in absolute left-[25em] top-0 z-[2] w-[23.5em] sm:left-[61em] sm:top-[0.5em] sm:w-[22em]" style={d(550)}>
            <div className="rotate-[2.5deg]">
              <div className="float" style={{ "--fs": "9s", "--fa": "-10px" } as React.CSSProperties}>
                <Phone screen="home" />
              </div>
            </div>
          </div>
          <Chip at={{ right: 1, bottom: 1.5 }} delay={1000} par={-26} surface="dark" className="sm:hidden">
            <FeeChip />
          </Chip>
          <Chip at={{ left: 1, bottom: 5 }} delay={1000} par={-34} floatSpeed={8} surface="dark" className="max-sm:hidden">
            <FeeChip />
          </Chip>
          <Chip at={{ left: 38, top: 1.5 }} delay={1250} par={18} floatSpeed={10} surface="dark" className="max-sm:hidden">
            <PresentChip />
          </Chip>
          <Chip at={{ right: 0.5, bottom: 22 }} delay={1500} par={-12} floatSpeed={11} surface="dark" className="max-sm:hidden">
            <ResultChip />
          </Chip>
          <Chip at={{ left: 0.5, top: 9 }} delay={1250} par={24} floatSpeed={8.5} surface="dark" className="sm:hidden">
            <PresentChip />
          </Chip>
        </Tilt>
      </div>
    </InView>
  );
}

function FeeChip() {
  return (
    <div className="flex items-center gap-[1em]">
      <Tile tone="glass" className="size-[3.6em]">
        <ReceiptIcon className="size-[1.9em]" />
      </Tile>
      <div className="pr-[0.6em]">
        <div className="text-[1.5em] font-semibold leading-tight tracking-[-0.01em]">Fee received</div>
        <div className="text-[1.15em] sub">Priya Shukla · ₹1,800</div>
      </div>
    </div>
  );
}

function PresentChip() {
  return (
    <div className="flex items-center gap-[1em]">
      <Tile tone="glass" className="size-[3.6em]">
        <BellIcon className="size-[1.8em]" />
      </Tile>
      <div className="pr-[0.6em]">
        <div className="text-[1.5em] font-semibold leading-tight tracking-[-0.01em]">Aarav is present</div>
        <div className="text-[1.15em] sub">Parent notified · 9:58 am</div>
      </div>
    </div>
  );
}

function ResultChip() {
  return (
    <div className="flex items-center gap-[0.9em]">
      <Tile tone="glass" className="size-[3em]">
        <AwardIcon className="size-[1.6em]" />
      </Tile>
      <div className="pr-[0.5em]">
        <div className="text-[1.35em] font-semibold leading-tight">Results published</div>
        <div className="text-[1.05em] sub">Class 9-A</div>
      </div>
    </div>
  );
}
