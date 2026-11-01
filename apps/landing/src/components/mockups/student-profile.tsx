"use client";

import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { MAvatar, MBadge, MPanel, Mockup, MWindow } from "./parts";

type EventKey = "promoted8b" | "changed" | "promoted7a" | "admitted";
const TIMELINE: ReadonlyArray<{ key: EventKey; detail: "promo2627" | "changedWhy" | "promo2526" | "scholar"; when: string; success?: boolean }> = [
  { key: "promoted8b", detail: "promo2627", when: "1 Apr 2026", success: true },
  { key: "changed", detail: "changedWhy", when: "14 Jul 2025" },
  { key: "promoted7a", detail: "promo2526", when: "1 Apr 2025", success: true },
  { key: "admitted", detail: "scholar", when: "12 Jun 2019" },
];

const PROMOTION: ReadonlyArray<{ key: "promote" | "repeat" | "left"; count: number; tone: "success" | "warning" | "danger" }> = [
  { key: "promote", count: 38, tone: "success" },
  { key: "repeat", count: 1, tone: "warning" },
  { key: "left", count: 1, tone: "danger" },
];

/** Student profile with the full-history timeline, plus the year-end promotion and "left" cards. */
export function StudentProfileMockup() {
  const m = useT().mock.stu;
  return (
    <Mockup>
      <MWindow title={m.title}>
        <div className="grid gap-3 px-4 pb-4 @lg:grid-cols-[1.15fr_1fr]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-3 rounded-[16px] bg-card p-4">
              <MAvatar name="Priya Shukla" className="size-12 text-[14px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold tracking-[-0.02em]">Priya Shukla</p>
                <p className="truncate text-[11px] text-text-tertiary">{m.classLine}</p>
              </div>
              <MBadge tone="success">{m.active}</MBadge>
            </div>

            <MPanel title={m.history}>
              <ol className="relative flex flex-col gap-4">
                {TIMELINE.map((event, index) => (
                  <li key={event.key} className="relative flex gap-3">
                    {index < TIMELINE.length - 1 ? <span className="absolute left-[5px] top-4 h-[calc(100%+4px)] w-px bg-separator" /> : null}
                    <span
                      className={cn(
                        "mt-1 size-[11px] shrink-0 rounded-full",
                        event.success ? "bg-success" : "bg-text-tertiary",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold">{m[event.key]}</p>
                      <p className="text-[11px] text-text-secondary">{m[event.detail]}</p>
                      <p className="text-[10px] text-text-tertiary">{event.when}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </MPanel>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <MPanel title={m.promotionTitle} aside={<MBadge>{m.draft}</MBadge>}>
              <p className="mb-3 text-[11px] text-text-secondary">{m.promoLine}</p>
              <div className="flex flex-col gap-2">
                {PROMOTION.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-[12px] bg-bg px-3 py-2.5">
                    <MBadge tone={item.tone} className="bg-transparent px-0">
                      {m[item.key]}
                    </MBadge>
                    <span className="text-[14px] font-bold tabular-nums">{item.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid h-9 place-items-center rounded-full bg-solid text-[12px] font-semibold text-on-solid">{m.apply}</div>
            </MPanel>

            <MPanel title={m.markLeft}>
              <div className="flex flex-col gap-2 text-[11px]">
                <div className="rounded-[12px] bg-fill px-3 py-2.5">
                  <p className="text-text-tertiary">{m.leavingDate}</p>
                  <p className="font-semibold">30 Nov 2026</p>
                </div>
                <div className="rounded-[12px] bg-fill px-3 py-2.5">
                  <p className="text-text-tertiary">{m.reason}</p>
                  <p className="font-semibold">{m.reasonValue}</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-[1.5] text-text-tertiary">
                {m.leftNote}
              </p>
            </MPanel>
          </div>
        </div>
      </MWindow>
    </Mockup>
  );
}
