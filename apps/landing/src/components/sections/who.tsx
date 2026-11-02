import type { CSSProperties, ReactNode } from "react";
import { AwardIcon, BellIcon, CalendarCheckIcon, CheckIcon, ReceiptIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { Phone } from "@/components/mockups/devices";
import { CountUp, Parallax, Pop, Reveal } from "@/components/motion";
import { BENTO, WHO_CHIP, WHO_HEAD } from "@/lib/content";
import { cn } from "@/lib/cn";
import { Heading } from "./heading";

const LIFT = "[filter:drop-shadow(0_8px_20px_rgba(20,20,30,0.07))]";
const WHITE = "rounded-[18px] bg-bg p-3.5";

type TileProps = { title: string; line: string; tint: string; i: number; className?: string; children: ReactNode; textOver?: boolean };

/** One pastel bento tile: nested UI on top, bold title and a short line at the bottom. */
function Tile({ title, line, tint, i, className, children, textOver = false }: TileProps) {
  return (
    <Reveal i={i} stagger={110} y={44} blur={0} duration={1100} className={cn("h-full", className)}>
      <div className="relative flex h-full min-h-[300px] flex-col overflow-hidden rounded-[32px] p-6 sm:p-7" style={{ background: `linear-gradient(165deg, ${tint}, ${tint})` }}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(255,255,255,0.65),rgba(255,255,255,0))]" />
        <div className="relative flex-1">{children}</div>
        <div className={cn("relative", textOver && "z-10 -mx-7 -mb-7 mt-auto px-7 pb-7 pt-12")} style={textOver ? { background: `linear-gradient(to top, ${tint} 62%, transparent)` } : undefined}>
          <h3 className="text-[clamp(1.35rem,2vw,1.65rem)] font-bold tracking-[-0.03em]">{title}</h3>
          <p className="mt-1.5 max-w-[34ch] text-[15px] leading-snug text-text-secondary sm:text-[16px]">{line}</p>
        </div>
      </div>
    </Reveal>
  );
}

function Float({ children, className, speed = -0.04, delay = 500 }: { children: ReactNode; className?: string; speed?: number; delay?: number }) {
  return (
    <Parallax speed={speed} className={className}>
      <Pop delay={delay}>
        <div className={cn(WHITE, LIFT)}>{children}</div>
      </Pop>
    </Parallax>
  );
}

function Stat({ icon: Icon, label, children }: { icon: typeof BellIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#F3F3F6] text-text">
        <Icon className="size-[18px]" />
      </span>
      <div>
        <div className="text-[12px] font-medium text-text-secondary">{label}</div>
        <div className="text-[22px] font-bold leading-none tracking-[-0.02em]">{children}</div>
      </div>
    </div>
  );
}

function OwnersUi() {
  return (
    <div className="flex flex-wrap items-start gap-3 pb-5">
      <Float delay={400}>
        <Stat icon={ReceiptIcon} label="Fees collected">
          <CountUp to={426000} prefix="₹" delay={500} />
        </Stat>
      </Float>
      <Float delay={560} speed={0.04} className="sm:mt-5">
        <Stat icon={CalendarCheckIcon} label="Present today">
          <CountUp to={96} suffix="%" delay={650} />
        </Stat>
      </Float>
      <Float delay={720} speed={-0.02} className="hidden lg:block">
        <Stat icon={BellIcon} label="Dues pending">
          <CountUp to={42} delay={800} />
        </Stat>
      </Float>
    </div>
  );
}

function TeachersUi() {
  const rows: Array<[string, "P" | "H" | "A"]> = [
    ["Aarav", "P"],
    ["Diya", "P"],
    ["Kabir", "A"],
  ];
  return (
    <div className="flex flex-wrap items-start gap-3 pb-5">
      <Float delay={400} className="w-[230px] max-w-full">
        <div className="mb-2 flex items-center justify-between text-[12px] font-semibold">
          <span>Class 8-B</span>
          <span className="text-text-secondary">
            <CountUp to={38} delay={600} />/40 marked
          </span>
        </div>
        <ul className="space-y-1.5">
          {rows.map(([n, s]) => (
            <li key={n} className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="grid size-6 place-items-center rounded-full bg-[#E4E8EF] text-[10px] font-bold text-text-secondary">{n[0]}</span>
              <span className="flex-1">{n}</span>
              {(["P", "H", "A"] as const).map((k) => (
                <span key={k} className={cn("grid size-6 place-items-center rounded-full text-[10px] font-bold", s === k ? (k === "A" ? "bg-[#E7C7C7]" : "bg-solid text-on-solid") : "bg-card text-text-tertiary")}>
                  {k}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </Float>
      <Float delay={620} speed={0.04} className="sm:mt-8">
        <Stat icon={AwardIcon} label="Marks entered">
          <CountUp to={32} suffix="/40" delay={800} />
        </Stat>
      </Float>
    </div>
  );
}

function ParentsUi() {
  return (
    <div className="mx-auto w-[min(250px,70%)] pt-2">
      <Parallax speed={0.05}>
        <Pop delay={300} stagger={0}>
          <Phone screen="home" />
        </Pop>
      </Parallax>
    </div>
  );
}

function AppUi() {
  const items: Array<[typeof BellIcon, string, string, string]> = [
    [CheckIcon, "Aarav is present", "9:58 am", "ml-0 mr-10"],
    [ReceiptIcon, "Fee receipt ready", "8:30 am", "ml-6 mr-4"],
    [AwardIcon, "Results published", "Yesterday", "ml-12 mr-0"],
  ];
  return (
    <ul className="space-y-2 pb-4">
      {items.map(([I, t, w, off], i) => (
        <li key={t} className={off}>
          <Pop delay={350} i={i} stagger={190}>
            <div className={cn("flex items-center gap-3 !rounded-[18px] !px-3.5 !py-2.5", WHITE, LIFT)}>
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", i === 0 ? "bg-solid text-on-solid" : "bg-[#F3F3F6] text-text-secondary")}>
                <I className="size-4" />
              </span>
              <span className="flex-1 text-[14px] font-semibold">{t}</span>
              <span className="text-[11px] text-text-tertiary">{w}</span>
            </div>
          </Pop>
        </li>
      ))}
    </ul>
  );
}

function ReportsUi() {
  const vals = [38, 52, 44, 66, 58, 82, 62, 74];
  const HI = 5;
  return (
    <div className="pb-5">
      <Float delay={300} className="max-w-[420px]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-text-secondary">Monthly collection</span>
          <span className="text-[13px] font-bold">
            <CountUp to={4.2} prefix="₹" suffix="L" decimals={1} delay={700} />
          </span>
        </div>
        <div className="mt-3 flex h-[96px] items-end gap-2">
          {vals.map((h, i) => (
            <span
              key={i}
              className={cn("bary flex-1 rounded-full", i === HI ? "bg-accent" : "bg-[linear-gradient(to_top,#D8DBE6,#E8EAF0)]")}
              style={{ height: `${h}%`, "--d": `${600 + i * 70}ms` } as CSSProperties}
            />
          ))}
        </div>
      </Float>
      <Pop delay={900} className="absolute right-0 top-2 hidden sm:block">
        <span className={cn("inline-flex h-9 items-center gap-2 rounded-full bg-bg px-4 text-[13px] font-semibold", LIFT)}>
          <span className="size-2 rounded-full bg-success" /> Excel export
        </span>
      </Pop>
    </div>
  );
}

export function Who() {
  return (
    <section id="who" aria-labelledby="who-h" className="bg-[#F3F3F6] px-3 pb-[100px] pt-[96px] sm:px-6 md:pb-[150px] md:pt-[140px]">
      <div className="mx-auto w-full max-w-[1200px]">
        <Reveal blur={0} y={50} duration={1200}>
          <div className="rounded-[36px] bg-[#E9E9EE] p-1.5 sm:rounded-[48px] sm:p-2">
            <div className="rounded-[30px] bg-[linear-gradient(180deg,#FFFFFF,#FAFAFB)] px-4 pb-6 pt-12 sm:rounded-[40px] sm:px-8 sm:pb-8 sm:pt-16 md:px-10 md:pb-10 md:pt-20">
              <div className="text-center">
                <span className="inline-flex h-8 items-center rounded-full bg-[#F3F3F6] px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">{WHO_CHIP}</span>
                <Heading id="who" title={WHO_HEAD.title} dim={WHO_HEAD.dim} line={WHO_HEAD.line} className="mt-5" />
              </div>
              <div className="mt-12 flex flex-col gap-3 sm:gap-4 md:mt-16">
                <div className="relative grid gap-3 md:grid-cols-[5fr_7fr] md:gap-4">
                  <Tile i={0} title={BENTO.parents.title} line={BENTO.parents.line} tint="#F4EDE4" textOver className="md:row-span-2">
                    <ParentsUi />
                  </Tile>
                  <div className="flex flex-col gap-3 md:gap-4">
                    <Tile i={1} title={BENTO.owners.title} line={BENTO.owners.line} tint="#FFE9DC" className="flex-1">
                      <OwnersUi />
                    </Tile>
                    <Tile i={2} title={BENTO.teachers.title} line={BENTO.teachers.line} tint="#E4E8EF" className="flex-1">
                      <TeachersUi />
                    </Tile>
                  </div>
                  <Pop delay={600} className="absolute left-[calc((100%-16px)*5/12+8px)] top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:block">
                    <div className="node-pulse relative size-[72px] rounded-full">
                      <div className={cn("relative grid size-full place-items-center rounded-full bg-[linear-gradient(180deg,#2A2A2D,#1C1C1E)] text-[#fff]", "[filter:drop-shadow(0_10px_20px_rgba(20,20,30,0.25))]")}>
                        <LogoMark className="size-7" />
                      </div>
                    </div>
                  </Pop>
                </div>
                <div className="grid gap-3 md:grid-cols-[7fr_5fr] md:gap-4">
                  <Tile i={3} title={BENTO.reports.title} line={BENTO.reports.line} tint="#EEEFF3">
                    <ReportsUi />
                  </Tile>
                  <Tile i={4} title={BENTO.app.title} line={BENTO.app.line} tint="#FAF1D6">
                    <AppUi />
                  </Tile>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
