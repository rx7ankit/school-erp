"use client";

import { useT } from "@/lib/i18n";
import { PhoneFrame } from "@/components/phone-frame";
import { AwardIcon, ChatIcon, HomeIcon, RupeeIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { MBadge } from "./parts";

function ChildSwitcher({ active }: { active: "Ananya" | "Aarav" }) {
  return (
    <div className="flex gap-1.5">
      {(["Ananya", "Aarav"] as const).map((child) => (
        <span
          key={child}
          className={cn(
            "rounded-full px-3 py-1.5 text-[12px] font-semibold",
            child === active ? "bg-solid text-on-solid" : "bg-fill text-text-secondary",
          )}
        >
          {child}
        </span>
      ))}
    </div>
  );
}

function TabBar({ active }: { active: "home" | "results" }) {
  const labels = useT().mock.phone.tabs;
  const tabs = [
    { key: "home", label: labels[0], Icon: HomeIcon },
    { key: "results", label: labels[1], Icon: AwardIcon },
    { key: "fees", label: labels[2], Icon: RupeeIcon },
    { key: "messages", label: labels[3], Icon: ChatIcon },
  ] as const;
  return (
    <div className="flex justify-around bg-card px-2 py-2">
      {tabs.map(({ key, label, Icon }) => (
        <span key={key} className={cn("flex flex-col items-center gap-0.5 text-[9px] font-semibold", key === active ? "text-accent" : "text-text-tertiary")}>
          <Icon className="size-[18px]" />
          {label}
        </span>
      ))}
    </div>
  );
}

const WEEK = ["P", "P", "H", "P", "P", "P", "A"] as const;

/** Parent app home: child switcher, attendance, fee due, latest class broadcast. */
export function ParentHomePhone({ className }: { className?: string }) {
  const m = useT().mock.phone;
  return (
    <PhoneFrame className={className}>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden px-4 pt-2">
          <p className="text-[11px] text-text-tertiary">{m.date}</p>
          <p className="mb-3 text-[22px] font-bold leading-tight tracking-[-0.03em]">{m.greeting}</p>
          <ChildSwitcher active="Ananya" />

          <div className="mt-3 rounded-[18px] bg-card p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold">{m.attMonth}</p>
              <MBadge tone="success">{m.good}</MBadge>
            </div>
            <p className="mt-1 text-[28px] font-bold leading-none tracking-[-0.04em]">94%</p>
            <div className="mt-3 flex gap-1.5">
              {WEEK.map((day, index) => (
                <span
                  key={index}
                  className={cn(
                    "grid h-7 flex-1 place-items-center rounded-[8px] text-[10px] font-bold",
                    day === "P" && "bg-solid text-on-solid",
                    day === "H" && "bg-warning/25 text-warning",
                    day === "A" && "bg-fill text-danger",
                  )}
                >
                  {day}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-text-tertiary">{m.legend}</p>
          </div>

          <div className="mt-2 rounded-[18px] bg-card p-3.5">
            <p className="text-[12px] font-bold">{m.broadcastTitle}</p>
            <p className="mt-0.5 text-[10px] text-text-tertiary">{m.broadcastMeta}</p>
            <p className="mt-1.5 text-[12px] leading-[1.4] text-text-secondary">{m.broadcast}</p>
          </div>

          <div className="mt-2 flex items-center justify-between rounded-[18px] bg-card p-3.5">
            <div>
              <p className="text-[12px] font-bold">{m.feeTitle}</p>
              <p className="text-[10px] text-text-tertiary">{m.feeMeta}</p>
            </div>
            <p className="text-[15px] font-bold tabular-nums">₹1,800</p>
          </div>
        </div>
        <TabBar active="home" />
      </div>
    </PhoneFrame>
  );
}

const MARKS = [88, 91, 84, 79, 82] as const;

/** Parent app results: shows only after the class teacher publishes. */
export function ParentResultsPhone({ className }: { className?: string }) {
  const m = useT().mock.phone;
  return (
    <PhoneFrame className={className}>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden px-4 pt-2">
          <p className="mb-3 text-[22px] font-bold leading-tight tracking-[-0.03em]">{m.resultsTitle}</p>
          <ChildSwitcher active="Ananya" />

          <div className="mt-3 rounded-[18px] bg-card p-3.5">
            <p className="text-[12px] font-bold">{m.exam}</p>
            <p className="mt-0.5 text-[10px] text-text-tertiary">{m.publishedBy}</p>
            <p className="mt-3 text-[28px] font-bold leading-none tracking-[-0.04em]">
              424<span className="dim text-[16px] tracking-normal"> / 500</span>
            </p>
            <p className="mt-1 text-[11px] font-semibold text-success">84.8%</p>
          </div>

          <div className="mt-2 rounded-[18px] bg-card p-3.5">
            <div className="flex flex-col gap-2.5">
              {MARKS.map((marks, index) => (
                <div key={index} className="flex items-center gap-2 text-[11px]">
                  <span className="w-[84px] shrink-0 truncate font-medium">{m.subjects[index]}</span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fill">
                    <span className="block h-full rounded-full bg-text" style={{ width: `${marks}%` }} />
                  </span>
                  <span className="w-5 text-right font-bold tabular-nums">{marks}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
        <TabBar active="results" />
      </div>
    </PhoneFrame>
  );
}
