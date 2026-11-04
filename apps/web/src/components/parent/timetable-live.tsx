"use client";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useChild } from "@/components/parent-child";
import { Loaded, ParentSk } from "@/components/parent/live-ui";
import { clock12 } from "@/components/parent/bits";
import { useParentTimetable } from "@/lib/api/hooks/parent";
import { useData, useLang } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";
import { useTodayIST } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const DAYS = [{ n: 1, short: "Mon", long: "Monday" }, { n: 2, short: "Tue", long: "Tuesday" }, { n: 3, short: "Wed", long: "Wednesday" }, { n: 4, short: "Thu", long: "Thursday" }, { n: 5, short: "Fri", long: "Friday" }, { n: 6, short: "Sat", long: "Saturday" }];

/** The weekly grid: real day headings, six period rows of placeholder cells. */
function TimetableSk({ todayWd = -1 }: { todayWd?: number }) {
  const t = useT(), lang = useLang();
  const dayName = (n: number, short: string) => lang === "en" ? short : new Intl.DateTimeFormat("hi-IN", { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(2024, 0, n)));
  return (
    <ParentSk>
      <div className="overflow-x-auto rounded-[20px] bg-card p-2 sm:p-3">
        <table className="w-full min-w-[760px] border-separate border-spacing-1 text-left">
          <thead>
            <tr>
              <th scope="col" className="w-36 px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{t("tt.period")}</th>
              {DAYS.map((x) => <th key={x.n} scope="col" className={cn("rounded-xl px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary", x.n === todayWd && "bg-fill text-foreground")}>{dayName(x.n, x.short)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, r) => (
              <tr key={r}>
                <th scope="row" className="px-3 py-2 align-top"><Skeleton className="h-4 w-16" /><Skeleton className="mt-1.5 h-3 w-24" /></th>
                {DAYS.map((x) => <td key={x.n} className="p-0 align-top"><Skeleton className="block min-h-14 w-full rounded-xl" /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ParentSk>
  );
}

export function TimetableLive() {
  const t = useT(), d = useData(), lang = useLang();
  const sel = useChild();
  const today = useTodayIST();
  const q = useParentTimetable(sel?.child.id ?? "", today || undefined);
  if (!sel) return null;
  if (!today) return <><PageHeader title={t("tt.title")} /><TimetableSk /></>;
  const dayName = (n: number, style: "short" | "long", fallback: string) => lang === "en" ? fallback
    : new Intl.DateTimeFormat("hi-IN", { timeZone: "UTC", weekday: style }).format(new Date(Date.UTC(2024, 0, n)));
  return (
    <>
      <PageHeader title={t("tt.title")} />
      <Loaded q={q} loading={<TimetableSk />}>
        {(tt) => {
          const todayWd = new Date(`${tt.on}T00:00:00Z`).getUTCDay();
          const subs = new Map(tt.today.filter((e) => e.substitute_name).map((e) => [e.slot.id, e.substitute_name!]));
          const periods = [...tt.periods].sort((a, b) => a.number - b.number);
          if (!periods.length) return <p className="rounded-[20px] bg-card p-5 text-sm text-muted-foreground">{t("pl.noTimetable")}</p>;
          return (
            <div className="overflow-x-auto rounded-[20px] bg-card p-2 sm:p-3" tabIndex={0} role="region" aria-label={t("tt.region")}>
              <table className="w-full min-w-[760px] border-separate border-spacing-1 text-left">
                <thead>
                  <tr>
                    <th scope="col" className="w-36 px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{t("tt.period")}</th>
                    {DAYS.map((x) => (
                      <th key={x.n} scope="col" className={cn("rounded-xl px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary", x.n === todayWd && "bg-fill text-foreground")}>
                        <abbr title={dayName(x.n, "long", x.long)} className="no-underline">{dayName(x.n, "short", x.short)}</abbr>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="sticky left-0 z-[1] bg-card px-3 py-2 align-top"><span className="block text-sm font-bold">{d(p.name)}</span><span className="block whitespace-nowrap text-xs font-normal tabular-nums text-text-tertiary">{clock12(p.starts_at)} – {clock12(p.ends_at)}</span></th>
                      {DAYS.map((x) => {
                        const slot = tt.slots.find((s) => s.weekday === x.n && s.period_id === p.id);
                        const sub = slot && x.n === todayWd ? subs.get(slot.id) : undefined;
                        return (
                          <td key={x.n} className="p-0 align-top">
                            <div className={cn("block h-full min-h-14 w-full rounded-xl px-3 py-2 text-left align-top", x.n === todayWd ? "bg-fill/60" : "bg-background/40")}>
                              <span className={cn("block text-sm font-medium", !slot && "text-text-tertiary")}>{slot ? d(slot.subject_name) : "—"}</span>
                              {slot && <span className={cn("block truncate text-xs text-muted-foreground", sub && "line-through opacity-60")}>{slot.staff_name}</span>}
                              {sub && <span className="block truncate text-xs font-medium text-foreground">{t("tt.sub", { name: sub })}</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }}
      </Loaded>
    </>
  );
}
