import type { ReactNode } from "react";
import { AwardIcon, BellIcon, CalendarCheckIcon, CheckIcon, ChatIcon, GridIcon, ReceiptIcon, RupeeIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { CountUp, DrawLine, Parallax, Pop, Reveal } from "@/components/motion";
import { ALSO_ROW, SOFTWARE_CARDS, SOFTWARE_HEAD, SOFTWARE_NODES } from "@/lib/content";
import { cn } from "@/lib/cn";
import { Heading } from "./heading";

const ICONS = [CalendarCheckIcon, RupeeIcon, AwardIcon, ChatIcon, GridIcon] as const;
const LIFT = "[filter:drop-shadow(0_8px_22px_rgba(20,20,30,0.07))]";

/** The dark glass pill at the centre of the diagram. */
function Node({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="node-pulse relative rounded-full">
        <div className="relative flex h-[76px] items-center gap-3 rounded-full bg-[linear-gradient(180deg,#2A2A2D,#1C1C1E)] px-9 text-[#fff] [filter:drop-shadow(0_16px_28px_rgba(20,20,30,0.22))] md:h-[88px] md:px-11">
          <span aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]" />
          <Logo className="h-7 md:h-8" />
        </div>
      </div>
    </div>
  );
}

function SatPill({ i }: { i: number }) {
  const Icon = ICONS[i];
  return (
    <span className={cn("pill-float flex h-12 items-center gap-2.5 whitespace-nowrap rounded-full bg-bg px-5 text-[15px] font-semibold", LIFT)} style={{ "--i": i } as React.CSSProperties}>
      <Icon className="size-[18px] text-text-secondary" />
      {SOFTWARE_NODES[i]}
    </span>
  );
}

/* x / y in the 1000 x 340 diagram space (percent of the box). Order matches SOFTWARE_NODES. */
const SPOTS = [
  { x: 15, y: 27 }, // attendance
  { x: 15, y: 79 }, // fees
  { x: 85, y: 27 }, // results
  { x: 85, y: 79 }, // messages
  { x: 50, y: 9 }, // timetable
] as const;

const WIRES = [
  "M215 92 C330 92 310 182 440 182",
  "M215 268 C330 268 310 182 440 182",
  "M785 92 C670 92 690 182 560 182",
  "M785 268 C670 268 690 182 560 182",
  "M500 52 V150",
];

function Diagram() {
  return (
    <div aria-hidden="true" className="relative mx-auto hidden h-[340px] w-full max-w-[1000px] md:block">
      <DrawLine d={WIRES} viewBox="0 0 1000 340" preserveAspectRatio="none" stroke="#C9CBD3" strokeWidth={1.25} duration={1100} stagger={140} className="absolute inset-0 size-full" />
      <div className="absolute left-1/2 top-[53.5%] z-10 -translate-x-1/2 -translate-y-1/2">
        <Pop delay={0} stagger={0}>
          <Node />
        </Pop>
      </div>
      {SPOTS.map((s, i) => (
        <div key={i} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          <Pop delay={450} i={i} stagger={130}>
            <SatPill i={i} />
          </Pop>
        </div>
      ))}
    </div>
  );
}

function DiagramMobile() {
  return (
    <div aria-hidden="true" className="md:hidden">
      <div className="flex justify-center">
        <Pop>
          <Node />
        </Pop>
      </div>
      <DrawLine d="M150 0 V40" viewBox="0 0 300 40" stroke="#C9CBD3" className="mx-auto h-10 w-[150px]" />
      <ul className="mx-auto grid max-w-[340px] grid-cols-2 justify-items-center gap-3">
        {SOFTWARE_NODES.map((_, i) => (
          <li key={i} className={i === 4 ? "col-span-2" : undefined}>
            <Pop delay={300} i={i} stagger={110}>
              <SatPill i={i} />
            </Pop>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------------------- cards */
const ROW = "flex items-center gap-2.5 rounded-[14px] bg-bg/90 px-3 py-2";
const AV = "grid size-7 shrink-0 place-items-center rounded-full bg-[linear-gradient(150deg,#F0F0F3,#D9D9DE)] text-[10px] font-bold text-text-secondary";

function Chip({ children, className, speed = -0.04 }: { children: ReactNode; className?: string; speed?: number }) {
  return (
    <Parallax speed={speed} className={cn("absolute z-10", className)}>
      <Pop delay={900}>
        <div className={cn("w-max rounded-[18px] bg-bg p-3.5", LIFT)}>{children}</div>
      </Pop>
    </Parallax>
  );
}

function AttendanceSnippet() {
  const rows: Array<[string, string, "P" | "H" | "A"]> = [
    ["AS", "Aarav Sharma", "P"],
    ["DP", "Diya Patel", "P"],
    ["KS", "Kabir Singh", "A"],
    ["IV", "Ishita Verma", "H"],
  ];
  return (
    <>
      <ul className="space-y-1.5">
        {rows.map(([ini, name, s]) => (
          <li key={name} className={ROW}>
            <span className={AV}>{ini}</span>
            <span className="flex-1 truncate text-[13px] font-semibold">{name}</span>
            <span className="flex gap-1">
              {(["P", "H", "A"] as const).map((k) => (
                <span key={k} className={cn("grid size-6 place-items-center rounded-full text-[10px] font-bold", s === k ? (k === "P" ? "bg-solid text-on-solid" : k === "H" ? "bg-[#F4D9BE] text-text" : "bg-[#E7C7C7] text-text") : "bg-card text-text-tertiary")}>
                  {k}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <Chip className="-bottom-7 -right-5 md:-right-7">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-solid text-on-solid">
            <BellIcon className="size-[18px]" />
          </span>
          <div>
            <div className="text-[22px] font-bold leading-none tracking-[-0.02em]">
              <CountUp to={38} delay={900} />
            </div>
            <div className="mt-1 text-[12px] font-medium text-text-secondary">parents notified</div>
          </div>
        </div>
      </Chip>
    </>
  );
}

function FeesSnippet() {
  return (
    <>
      <div className="rounded-[16px] bg-bg/95 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-text-secondary">Receipt #2041</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/[0.1] px-2 py-0.5 text-[11px] font-semibold text-success">
            <CheckIcon className="size-3" /> Paid
          </span>
        </div>
        <div className="mt-2 text-[34px] font-bold leading-none tracking-[-0.03em]">₹1,800</div>
        <div className="mt-1 text-[12px] text-text-secondary">Aarav Sharma · Term 2</div>
        <div className="mt-3 space-y-1.5 border-t border-card pt-3 text-[12px]">
          <div className="flex justify-between text-text-secondary">
            <span>Tuition</span>
            <span className="font-semibold text-text">₹1,500</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Transport</span>
            <span className="font-semibold text-text">₹300</span>
          </div>
        </div>
      </div>
      <Chip className="-bottom-7 -right-5 md:-right-7">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[#FFE9DC] text-text">
            <ReceiptIcon className="size-[18px]" />
          </span>
          <div>
            <div className="text-[12px] font-medium text-text-secondary">Due</div>
            <div className="text-[22px] font-bold leading-none tracking-[-0.02em]">
              <CountUp to={42600} prefix="₹" delay={900} />
            </div>
          </div>
        </div>
      </Chip>
    </>
  );
}

function ResultsSnippet() {
  const rows: Array<[string, number, string]> = [
    ["Mathematics", 92, "A+"],
    ["Science", 88, "A"],
    ["English", 90, "A+"],
    ["Hindi", 81, "A"],
  ];
  return (
    <>
      <ul className="space-y-2.5 rounded-[16px] bg-bg/95 p-4">
        {rows.map(([s, m, g], i) => (
          <li key={s}>
            <div className="mb-1 flex justify-between text-[12px]">
              <span className="font-semibold">{s}</span>
              <span className="font-bold tabular-nums">
                {m} <span className="ml-1 text-text-tertiary">{g}</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-card">
              <div className="barx h-full rounded-full bg-[#2A2A2C]" style={{ width: `${m}%`, "--d": `${600 + i * 100}ms` } as React.CSSProperties} />
            </div>
          </li>
        ))}
      </ul>
      <Chip className="-bottom-7 -right-5 md:-right-7">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[#FAF1D6] text-text">
            <AwardIcon className="size-[18px]" />
          </span>
          <div>
            <div className="text-[22px] font-bold leading-none tracking-[-0.02em]">
              <CountUp to={87} suffix="%" delay={900} />
            </div>
            <div className="mt-1 text-[12px] font-medium text-text-secondary">Grade A, Rank 3</div>
          </div>
        </div>
      </Chip>
    </>
  );
}

const CARD_UI = [
  { Icon: CalendarCheckIcon, tint: "#EEEFF3", panel: "bg-[linear-gradient(160deg,#EEEFF3,#E4E8EF)]", Snippet: AttendanceSnippet },
  { Icon: RupeeIcon, tint: "#FFE9DC", panel: "bg-[linear-gradient(160deg,#FFF1E7,#FFE3D1)]", Snippet: FeesSnippet },
  { Icon: AwardIcon, tint: "#FAF1D6", panel: "bg-[linear-gradient(160deg,#FBF4DE,#F6EBCB)]", Snippet: ResultsSnippet },
] as const;

function Cards() {
  return (
    <ul className="grid gap-8 md:grid-cols-3 md:items-start md:gap-6">
      {SOFTWARE_CARDS.map((c, i) => {
        const { Icon, tint, panel, Snippet } = CARD_UI[i];
        return (
          <li key={c.id} className={cn(i === 1 && "md:-translate-y-8")}>
            <Reveal i={i} stagger={140} y={40} blur={0} duration={1100}>
              <article className={cn("relative rounded-[28px] border border-[#ECECF0] bg-[linear-gradient(180deg,#FFFFFF,#F8F8FA)] p-5 pb-7", LIFT)}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-[13px] text-text" style={{ background: tint }}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="text-[22px] font-bold tracking-[-0.025em]">{c.title}</h3>
                </div>
                <p className="mt-3 text-[15px] leading-snug text-text-secondary">{c.line}</p>
                <div className={cn("relative mt-5 rounded-[22px] p-4 pb-9", panel)}>
                  <Snippet />
                </div>
              </article>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}

export function Software() {
  return (
    <section id="software" aria-labelledby="software-h" className="bg-bg px-4 pb-[100px] pt-[96px] sm:px-6 md:pb-[150px] md:pt-[140px]">
      <div className="mx-auto w-full max-w-[1200px]">
        <Heading id="software" title={SOFTWARE_HEAD.title} dim={SOFTWARE_HEAD.dim} line={SOFTWARE_HEAD.line} />
        <div className="mt-12 md:mt-16">
          <Diagram />
          <DiagramMobile />
          <DrawLine
            d={["M500 0 C500 40 167 30 167 90", "M500 0 V58", "M500 0 C500 40 833 30 833 90"]}
            viewBox="0 0 1000 90"
            preserveAspectRatio="none"
            stroke="#C9CBD3"
            strokeWidth={1.25}
            delay={900}
            duration={1000}
            stagger={100}
            className="mx-auto hidden h-[90px] w-full md:block"
          />
          <div className="mt-6 md:mt-0">
            <Cards />
          </div>
        </div>
        <Reveal className="mt-20 flex flex-wrap items-center justify-center gap-2.5 md:mt-28">
          <span className="mb-1 w-full text-center text-[15px] font-semibold text-text-secondary md:mb-0 md:mr-2 md:w-auto">Also included</span>
          {ALSO_ROW.map((a, i) => (
            <Pop key={a} i={i} stagger={70}>
              <span className="inline-flex h-10 items-center rounded-full bg-[#F3F3F6] px-4 text-[14px] font-semibold text-text-secondary">{a}</span>
            </Pop>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
