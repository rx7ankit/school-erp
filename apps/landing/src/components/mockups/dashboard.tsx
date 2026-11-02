"use client";

import { LogoMark } from "@/components/logo";
import {
  AwardIcon,
  BookIcon,
  CalendarCheckIcon,
  ChatIcon,
  HomeIcon,
  RupeeIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { MAvatar, MBadge, MPanel, MStat, Mockup, MWindow } from "./parts";

const NAV_ICONS = [HomeIcon, CalendarCheckIcon, UsersIcon, RupeeIcon, AwardIcon, BookIcon, ChatIcon, ShieldIcon] as const;

const CLASSES = [
  { name: "8-B", pct: 94 },
  { name: "7-A", pct: 91 },
  { name: "10-A", pct: 89 },
  { name: "5-C", pct: 96 },
  { name: "3-A", pct: 87 },
];

const RECEIPTS = [
  { who: "Priya Shukla", cls: "8-B", amount: "₹1,800", time: "10:21 am" },
  { who: "Aarav Tiwari", cls: "5-C", amount: "₹1,200", time: "10:04 am" },
  { who: "Ishita Pandey", cls: "10-A", amount: "₹2,400", time: "9:47 am" },
];

/** Staff dashboard with sidebar. The big hero mockup. */
export function DashboardMockup() {
  const m = useT().mock;
  const d = m.dash;
  return (
    <Mockup>
      <MWindow title="krevo.in / dashboard">
        <div className="flex">
          <div className="hidden w-[188px] shrink-0 flex-col gap-1 px-3 pb-4 @3xl:flex">
            <div className="mb-3 flex items-center gap-2.5 px-2">
              <LogoMark className="size-6" />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold">Demo School</p>
                <p className="truncate text-[10px] text-text-tertiary">Rewa, MP</p>
              </div>
            </div>
            {NAV_ICONS.map((Icon, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-3 py-2 text-[12px] font-medium",
                  index === 0 ? "bg-solid text-on-solid" : "text-text-secondary",
                )}
              >
                <Icon className="size-4" />
                {m.nav[index]}
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1 px-3 pb-4 @3xl:pl-0 @3xl:pr-4">
            <div className="mb-4 flex items-start justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="text-[11px] text-text-tertiary">{d.date}</p>
                <p className="mt-0.5 truncate text-[20px] font-bold leading-tight tracking-[-0.02em]">{d.greeting}</p>
              </div>
              <MAvatar name="Sunita Tripathi" className="hidden @md:grid" />
            </div>

            <div className="grid grid-cols-2 gap-2.5 @2xl:grid-cols-4">
              <MStat label={d.presentToday} value="412" note={d.ofStudents} />
              <MStat label={d.attendance} value="92%" note={d.wholeSchool} tone="success" />
              <MStat label={d.feesToday} value="₹38,500" note={d.receipts} />
              <MStat label={d.booksIssued} value="23" note={d.dueWeek} />
            </div>

            <div className="mt-2.5 grid gap-2.5 @2xl:grid-cols-[1.15fr_1fr]">
              <MPanel title={d.byClass} aside={<MBadge>{d.today}</MBadge>}>
                <div className="flex flex-col gap-2.5">
                  {CLASSES.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 text-[12px]">
                      <span className="w-9 shrink-0 font-medium">{c.name}</span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-fill">
                        <span className="block h-full rounded-full bg-text" style={{ width: `${c.pct}%` }} />
                      </span>
                      <span className="w-9 shrink-0 text-right font-semibold tabular-nums">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              </MPanel>

              <MPanel title={d.recent} aside={<MBadge tone="success">{d.offline}</MBadge>}>
                <div className="flex flex-col gap-3">
                  {RECEIPTS.map((r) => (
                    <div key={r.who} className="flex items-center gap-3">
                      <MAvatar name={r.who} className="size-7 text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold">{r.who}</p>
                        <p className="text-[10px] text-text-tertiary">
                          {d.classWord} {r.cls} · {r.time}
                        </p>
                      </div>
                      <span className="text-[12px] font-bold tabular-nums">{r.amount}</span>
                    </div>
                  ))}
                </div>
              </MPanel>
            </div>
          </div>
        </div>
      </MWindow>
    </Mockup>
  );
}
