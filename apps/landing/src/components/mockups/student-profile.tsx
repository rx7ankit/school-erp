import { cn } from "@/lib/cn";
import { MAvatar, MBadge, MPanel, Mockup, MWindow } from "./parts";

type Event = { title: string; detail: string; when: string; tone?: "success" | "warning" | "danger" | "brand" };

const TIMELINE: readonly Event[] = [
  { title: "Promoted to Class 8-B", detail: "Year-end promotion, 2026-27", when: "1 Apr 2026", tone: "success" },
  { title: "Class changed 7-A to 7-B", detail: "Section change at parent's request", when: "14 Jul 2025" },
  { title: "Promoted to Class 7-A", detail: "Year-end promotion, 2025-26", when: "1 Apr 2025", tone: "success" },
  { title: "Admitted to Class 1", detail: "Scholar no. 2019/0384", when: "12 Jun 2019" },
];

const PROMOTION = [
  { label: "Promote to 9-B", count: 38, tone: "success" as const },
  { label: "Repeat 8-B", count: 1, tone: "warning" as const },
  { label: "Left school", count: 1, tone: "danger" as const },
];

/** Student profile with the full-history timeline, plus the year-end promotion and "left" cards. */
export function StudentProfileMockup() {
  return (
    <Mockup>
      <MWindow title="Students · Priya Shukla">
        <div className="grid gap-3 px-4 pb-4 @lg:grid-cols-[1.15fr_1fr]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-3 rounded-[16px] bg-card p-4">
              <MAvatar name="Priya Shukla" className="size-12 text-[14px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold tracking-[-0.02em]">Priya Shukla</p>
                <p className="truncate text-[11px] text-text-tertiary">Class 8-B · Scholar no. 2019/0384</p>
              </div>
              <MBadge tone="success">Active</MBadge>
            </div>

            <MPanel title="History">
              <ol className="relative flex flex-col gap-4">
                {TIMELINE.map((event, index) => (
                  <li key={event.title} className="relative flex gap-3">
                    {index < TIMELINE.length - 1 ? <span className="absolute left-[5px] top-4 h-[calc(100%+4px)] w-px bg-separator" /> : null}
                    <span
                      className={cn(
                        "mt-1 size-[11px] shrink-0 rounded-full",
                        event.tone === "success" ? "bg-success" : "bg-text-tertiary",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold">{event.title}</p>
                      <p className="text-[11px] text-text-secondary">{event.detail}</p>
                      <p className="text-[10px] text-text-tertiary">{event.when}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </MPanel>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <MPanel title="Year-end promotion" aside={<MBadge>Draft</MBadge>}>
              <p className="mb-3 text-[11px] text-text-secondary">8-B to 9-B · 2026-27 to 2027-28</p>
              <div className="flex flex-col gap-2">
                {PROMOTION.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-[12px] bg-bg px-3 py-2.5">
                    <MBadge tone={item.tone} className="bg-transparent px-0">
                      {item.label}
                    </MBadge>
                    <span className="text-[14px] font-bold tabular-nums">{item.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid h-9 place-items-center rounded-full bg-solid text-[12px] font-semibold text-on-solid">Apply promotion</div>
            </MPanel>

            <MPanel title="Mark as left">
              <div className="flex flex-col gap-2 text-[11px]">
                <div className="rounded-[12px] bg-fill px-3 py-2.5">
                  <p className="text-text-tertiary">Leaving date</p>
                  <p className="font-semibold">30 Nov 2026</p>
                </div>
                <div className="rounded-[12px] bg-fill px-3 py-2.5">
                  <p className="text-text-tertiary">Reason</p>
                  <p className="font-semibold">Family moving to Satna</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-[1.5] text-text-tertiary">
                History stays. No new attendance or invoices. Parent view becomes read-only.
              </p>
            </MPanel>
          </div>
        </div>
      </MWindow>
    </Mockup>
  );
}
