import { AwardIcon, BellIcon, CalendarCheckIcon, CheckIcon, ChatIcon, ClockIcon, GridIcon, HomeIcon, ReceiptIcon, RupeeIcon, UsersIcon } from "@/components/icons";
import { CountUp, InView, Tilt } from "@/components/in-view";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/cn";
import { Avatar, Bar, Chip, Pill, Ring, Scaled } from "./kit";

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

export function BrowserDashboard({ className }: { className?: string }) {
  return (
    <Scaled design={72} ratio="72 / 51" className={className}>
      <div className="flex size-full flex-col overflow-hidden rounded-[1.8em] border border-separator bg-bg">
        {/* window chrome */}
        <div className="flex h-[3.9em] shrink-0 items-center gap-[1.2em] border-b border-separator bg-card px-[1.5em]">
          <span className="flex gap-[0.6em]">
            {[0, 1, 2].map((i) => (
              <i key={i} className="size-[1em] rounded-full bg-separator" />
            ))}
          </span>
          <span className="mx-auto flex h-[2.5em] w-[26em] items-center justify-center gap-[0.6em] rounded-full bg-bg text-[1.15em] text-text-secondary">
            <i className="size-[0.7em] rounded-full bg-success" />
            app.krevo.tech
          </span>
          <span className="w-[5em]" />
        </div>
        <div className="flex min-h-0 flex-1">
          {/* sidebar */}
          <aside className="flex w-[14em] shrink-0 flex-col border-r border-separator px-[1.2em] py-[1.5em]">
            <div className="flex items-center gap-[0.8em] px-[0.6em]">
              <LogoMark className="size-[2.6em]" />
              <span className="text-[1.7em] font-bold tracking-[-0.02em]">Krevo</span>
            </div>
            <ul className="mt-[1.8em] space-y-[0.3em]">
              {SIDE.map(([Icon, label], i) => (
                <li key={label} className={cn("flex h-[3.3em] items-center gap-[0.9em] rounded-[0.9em] px-[0.9em] text-[1.25em]", i === 0 ? "bg-card font-bold text-text" : "font-medium text-text-secondary")}>
                  <Icon className={cn("size-[1.35em]", i === 0 && "text-accent")} />
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
          <div className="flex min-w-0 flex-1 flex-col gap-[1.3em] bg-bg px-[2em] py-[1.8em]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[2.3em] font-bold leading-tight tracking-[-0.025em]">Good morning, Mrs. Tripathi</div>
                <div className="mt-[0.2em] text-[1.2em] text-text-secondary">Monday, 2 November</div>
              </div>
              <Pill tone="success">
                <i className="size-[0.6em] rounded-full bg-current" /> All classes marked
              </Pill>
            </div>
            <div className="grid grid-cols-3 gap-[1.1em]">
              <div className="flex items-center gap-[1.2em] rounded-[1.4em] bg-card p-[1.3em]">
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
              <div className="rounded-[1.4em] bg-card p-[1.3em]">
                <div className="text-[1.15em] text-text-secondary">Fees today</div>
                <div className="text-[2.7em] font-bold leading-tight tracking-[-0.02em]">
                  <CountUp prefix="₹" to={18400} />
                </div>
                <div className="mt-[0.6em] flex h-[3em] items-end gap-[0.45em]">
                  {[40, 62, 35, 80, 55, 92, 70].map((h, i) => (
                    <span key={i} className={cn("bary flex-1 rounded-[0.3em]", i === 5 ? "bg-accent" : "bg-separator")} style={{ height: `${h}%`, "--d": `${600 + i * 70}ms` } as React.CSSProperties} />
                  ))}
                </div>
              </div>
              <div className="rounded-[1.4em] bg-card p-[1.3em]">
                <div className="text-[1.15em] text-text-secondary">Pending dues</div>
                <div className="text-[2.7em] font-bold leading-tight tracking-[-0.02em] text-accent">
                  <CountUp prefix="₹" to={42600} />
                </div>
                <div className="mt-[0.8em] text-[1.1em] text-text-secondary">62 students</div>
                <Bar pct={38} className="mt-[0.7em]" color="bg-accent" delay={700} />
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-[1.1em]">
              <div className="rounded-[1.4em] bg-card p-[1.3em]">
                <div className="flex items-center justify-between">
                  <span className="text-[1.5em] font-bold">Today&apos;s timetable</span>
                  <ClockIcon className="size-[1.6em] text-text-tertiary" />
                </div>
                <ul className="mt-[0.9em] space-y-[0.6em]">
                  {PERIODS.map(([t, s, c, now]) => (
                    <li key={t} className={cn("flex items-center gap-[1em] rounded-[1em] px-[1em] py-[0.7em]", now ? "bg-bg" : "")}>
                      <span className="w-[3.6em] text-[1.2em] font-semibold tabular-nums text-text-secondary">{t}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[1.35em] font-bold leading-tight">{s}</span>
                        <span className="block text-[1.05em] text-text-secondary">{c}</span>
                      </span>
                      {now ? <Pill tone="accent">Now</Pill> : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[1.4em] bg-card p-[1.3em]">
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
                        <span className="grid size-[3em] shrink-0 place-items-center rounded-full bg-bg text-accent">
                          <I className="size-[1.5em]" />
                        </span>
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
    </Scaled>
  );
}

/* ======================================================================= Phone */
export type PhoneScreen = "home" | "results" | "alerts";

function Tabs({ active }: { active: number }) {
  const tabs = [HomeIcon, AwardIcon, RupeeIcon, ChatIcon];
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-around border-t border-separator bg-bg px-[1em] pb-[1.6em] pt-[1.1em]">
      {tabs.map((T, i) => (
        <T key={i} className={cn("size-[2.3em]", i === active ? "text-accent" : "text-text-tertiary")} />
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
            <div className="text-[2em] font-bold leading-tight tracking-[-0.02em]">Mr. Mishra</div>
          </div>
          <Avatar name="Aarav Mishra" tone="accent" className="size-[3.6em]" />
        </div>
        <div className="mt-[1.1em] flex items-center gap-[0.6em] rounded-full bg-card p-[0.4em] text-[1.15em] font-semibold">
          <span className="rounded-full bg-solid px-[1em] py-[0.5em] text-on-solid">Aarav</span>
          <span className="px-[0.6em] text-text-secondary">Diya</span>
          <span className="ml-auto pr-[0.8em] text-text-tertiary">Class 8-B</span>
        </div>
        <div className="mt-[1.1em] flex items-center gap-[1.2em] rounded-[1.8em] bg-card p-[1.3em]">
          <Ring value={96} className="size-[7.4em]">
            <span className="text-[1.9em] font-bold">96%</span>
          </Ring>
          <div className="min-w-0">
            <div className="text-[1.1em] text-text-secondary">Attendance</div>
            <div className="text-[1.6em] font-bold leading-tight">Present today</div>
            <div className="mt-[0.7em] flex gap-[0.4em]">
              {["M", "T", "W", "T", "F"].map((d, i) => (
                <span key={i} className={cn("grid size-[2.1em] place-items-center rounded-full text-[0.95em] font-bold", i < 4 ? "bg-solid text-on-solid" : "bg-fill text-text-tertiary")}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-[0.9em] flex items-center justify-between rounded-[1.8em] bg-accent-subtle p-[1.3em]">
          <div>
            <div className="text-[1.1em] font-semibold text-accent">Term 2 fee</div>
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
            <li key={t} className="flex items-center gap-[1em] rounded-[1.2em] bg-card px-[1.1em] py-[0.8em] text-[1.25em]">
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
        <div className="mt-[1.1em] flex items-center gap-[1.3em] rounded-[1.8em] bg-card p-[1.3em]">
          <Ring value={87} className="size-[8em]">
            <span className="text-[2.1em] font-bold">87%</span>
          </Ring>
          <div>
            <Pill tone="accent">Grade A</Pill>
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
              <Bar pct={m} delay={400 + i * 100} color={m >= 90 ? "bg-accent" : "bg-solid"} />
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
            <li key={t} className="flex gap-[1em] rounded-[1.6em] bg-card p-[1.1em]">
              <span className={cn("grid size-[3.6em] shrink-0 place-items-center rounded-full", i === 0 ? "bg-accent text-on-accent" : "bg-bg text-text-secondary")}>
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

export function Phone({ screen = "home", className }: { screen?: PhoneScreen; className?: string }) {
  return (
    <Scaled design={24} ratio="24 / 49" className={className}>
      <div className="relative size-full rounded-[3.9em] bg-solid p-[0.65em]">
        <div className="relative size-full overflow-hidden rounded-[3.3em] bg-bg">
          <div className="absolute left-1/2 top-[1em] z-10 h-[2.1em] w-[7em] -translate-x-1/2 rounded-full bg-solid" />
          <div className="absolute inset-x-0 top-0 z-[5] flex items-center justify-between px-[2.4em] pt-[1.3em] text-[1.15em] font-bold">
            <span>9:41</span>
            <span className="flex items-end gap-[0.2em]">
              {[0.5, 0.75, 1, 1.25].map((h) => (
                <i key={h} className="w-[0.35em] rounded-[1px] bg-text" style={{ height: `${h}em` }} />
              ))}
            </span>
          </div>
          {screen === "home" ? <HomeScreen /> : screen === "results" ? <ResultsScreen /> : <AlertsScreen />}
        </div>
      </div>
    </Scaled>
  );
}

/* ======================================================================= Hero composition */
/** Desktop: dashboard with the phone overlapping its right edge. Mobile: phone in front, dashboard peeking behind. */
export function HeroVisual() {
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
  return (
    <InView className="relative mx-auto w-full max-w-[1080px] [container-type:inline-size] aspect-[50/55] sm:aspect-[80/54]">
      <div aria-hidden="true" className="absolute inset-0 select-none [font-size:calc(100cqw/50)] sm:[font-size:calc(100cqw/80)]">
        <Tilt className="absolute inset-0" max={1.6}>
          <div className="hero-in absolute left-[13em] top-[9em] w-[66em] sm:left-0 sm:top-[4.5em]" style={d(250)}>
            <BrowserDashboard />
          </div>
          <div className="hero-in absolute left-[1em] top-0 z-[2] w-[26em] sm:left-[56.5em] sm:w-[22.5em]" style={d(450)}>
            <div className="float" style={{ "--fs": "9s", "--fa": "-10px" } as React.CSSProperties}>
              <Phone screen="home" />
            </div>
          </div>
          <Chip at={{ right: 1, bottom: 2.5 }} delay={1000} par={-26} className="sm:hidden">
            <FeeChip />
          </Chip>
          <Chip at={{ left: 2, bottom: 3 }} delay={1000} par={-26} className="max-sm:hidden">
            <FeeChip />
          </Chip>
          <Chip at={{ left: 38, top: 1.5 }} delay={1250} par={24} floatSpeed={8.5} className="max-sm:hidden">
            <PresentChip />
          </Chip>
          <Chip at={{ right: 0.5, top: 3 }} delay={1250} par={24} floatSpeed={8.5} className="sm:hidden">
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
      <span className="grid size-[3.4em] place-items-center rounded-full bg-success/10 text-success">
        <ReceiptIcon className="size-[1.9em]" />
      </span>
      <div>
        <div className="text-[1.5em] font-bold leading-tight">Fee received</div>
        <div className="text-[1.15em] text-text-secondary">Priya Shukla · ₹1,800</div>
      </div>
    </div>
  );
}

function PresentChip() {
  return (
    <div className="flex items-center gap-[1em]">
      <span className="grid size-[3.4em] place-items-center rounded-full bg-accent text-on-accent">
        <BellIcon className="size-[1.8em]" />
      </span>
      <div>
        <div className="text-[1.5em] font-bold leading-tight">Aarav is present</div>
        <div className="text-[1.15em] text-text-secondary">Parent notified · 9:58 am</div>
      </div>
    </div>
  );
}
