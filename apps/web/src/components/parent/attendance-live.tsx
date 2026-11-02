"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { Loaded } from "@/components/parent/live-ui";
import { markOf, monthOf, shiftMonth, type Mark } from "@/components/parent/bits";
import { useParentCalendar } from "@/lib/api/hooks/parent";
import { useFmt } from "@/lib/lang-context";
import { useT, useData } from "@/lib/parent-i18n";
import { useTodayIST } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const label = (ym: string, lang: "en" | "hi") => new Intl.DateTimeFormat(lang === "hi" ? "hi-IN-u-nu-latn" : "en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));
const DOT: Record<Mark, string> = { present: "", absent: "bg-danger", half: "bg-warning", leave: "bg-text-tertiary", holiday: "", none: "" };
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function AttendanceLive() {
  const sel = useChild();
  const today = useTodayIST();
  const [picked, setPicked] = React.useState<number | null>(null);
  const thisMonth = today ? monthOf(today) : "";
  const cur = useParentCalendar(sel?.child.id ?? "", thisMonth);
  if (!sel || !today) return null;
  // Early in a month there are no school days yet, so start on the previous month.
  const auto = cur.data && cur.data.stats.working_days === 0 ? -1 : 0;
  const offset = picked ?? auto;
  const ym = shiftMonth(thisMonth, offset);
  return <AttendanceMonth key={sel.child.id} sid={sel.child.id} name={sel.child.name} ym={ym} today={today} offset={offset} setOffset={setPicked} />;
}

function AttendanceMonth({ sid, name, ym, today, offset, setOffset }: {
  sid: string; name: string; ym: string; today: string; offset: number; setOffset: (n: number) => void;
}) {
  const t = useT(), d = useData(), f = useFmt(), lang = f.lang;
  const q = useParentCalendar(sid, ym);
  const lead = new Date(`${ym}-01T00:00:00Z`).getUTCDay();
  return (
    <>
      <PageHeader eyebrow={name} title={t("att.title")} dim={t("att.dim")} />
      <Loaded q={q}>
        {(cal) => {
          const st = cal.stats;
          const stale = q.isPlaceholderData;
          return (<>
            <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", stale && "opacity-60")}>
              <StatCard label={t("att.stat")} value={st.percentage != null ? `${st.percentage}%` : "—"} hint={t("att.hint")} />
              <StatCard label={t("att.present")} value={num(st.present_days)} /><StatCard label={t("att.absent")} value={num(st.absent_days)} /><StatCard label={t("att.half")} value={st.half_days} />
            </div>
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[17px] font-bold">{label(ym, lang)}</h2>
                <div className="flex gap-2">
                  <Button variant="secondary" size="icon-sm" aria-label={t("att.prev")} onClick={() => setOffset(offset - 1)}><ChevronLeft /></Button>
                  <Button variant="secondary" size="icon-sm" aria-label={t("att.next")} disabled={offset >= 0} onClick={() => setOffset(offset + 1)}><ChevronRight /></Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-tertiary">{t("att.days").split(",").map((x, i) => <span key={i} className="py-1">{x}</span>)}</div>
              <div className={cn("grid grid-cols-7 gap-1", stale && "opacity-60")}>
                {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
                {cal.days.map((day) => {
                  const m = day.day_on > today ? "none" : markOf(day, day.day_on);
                  return (
                    <div key={day.day_on} title={day.holiday ? d(day.holiday) : undefined} className={cn("flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-sm tabular-nums", day.day_on === today && "bg-fill font-bold", m === "holiday" && "text-text-tertiary")}>
                      {Number(day.day_on.slice(8))}
                      <span className={cn("size-1.5 rounded-full", DOT[m], m === "half" && "bg-gradient-to-r from-warning from-50% to-fill to-50%")} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-danger" />{t("att.legendAbsent")}</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-gradient-to-r from-warning from-50% to-fill to-50%" />{t("att.legendHalf")}</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-text-tertiary" />{t("att.legendLeave")}</span>
                <span>{t("att.holidays")}</span>
              </div>
              {cal.holidays.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm">
                  {cal.holidays.map((h) => <li key={h.id} className="flex justify-between gap-3"><span>{d(h.title)}</span><span className="tabular-nums text-muted-foreground">{f.on(h.from_on, "short")}{h.to_on !== h.from_on ? ` – ${f.on(h.to_on, "short")}` : ""}</span></li>)}
                </ul>
              )}
            </Card>
          </>);
        }}
      </Loaded>
    </>
  );
}
