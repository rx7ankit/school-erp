"use client";
import { isLive } from "@/lib/api/config";
import { AttendanceLive } from "@/components/parent/attendance-live";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { markFor, monthDays, monthStats, type DayMark } from "@/lib/parent-data";
import { useLang } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";
import { useTodayIST } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const shift = (ym: string, d: number) => { const [y, m] = ym.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };
const label = (ym: string, lang: "en" | "hi") => new Intl.DateTimeFormat(lang === "hi" ? "hi-IN-u-nu-latn" : "en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));
const DOT: Record<DayMark, string> = { present: "", absent: "bg-danger", half: "bg-warning", leave: "bg-text-tertiary", holiday: "", none: "" };

function ParentAttendanceDemo() {
  const t = useT(), lang = useLang();
  const sel = useChild();
  const today = useTodayIST();
  const [picked, setPicked] = React.useState<number | null>(null);
  if (!sel || !today) return null;
  // Early in a month there are no school days yet, so start on the previous month.
  const auto = monthStats(sel.child.id, today.slice(0, 7), today).working === 0 ? -1 : 0;
  const offset = picked ?? auto;
  const ym = shift(today.slice(0, 7), offset);
  const days = monthDays(ym);
  const lead = new Date(`${ym}-01T00:00:00Z`).getUTCDay();
  const st = monthStats(sel.child.id, ym, today);

  return (
    <>
      <PageHeader title={t("att.title")} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("att.stat")} value={`${st.pct}%`} />
        <StatCard label={t("att.present")} value={st.present} /><StatCard label={t("att.absent")} value={st.absent} /><StatCard label={t("att.half")} value={st.half} />
      </div>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{label(ym, lang)}</h2>
          <div className="flex gap-2">
            <Button variant="secondary" size="icon-sm" aria-label={t("att.prev")} onClick={() => setPicked(offset - 1)}><ChevronLeft /></Button>
            <Button variant="secondary" size="icon-sm" aria-label={t("att.next")} disabled={offset >= 0} onClick={() => setPicked(offset + 1)}><ChevronRight /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-tertiary">{t("att.days").split(",").map((d, i) => <span key={i} className="py-1">{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
          {days.map((d) => {
            const m = markFor(sel.child.id, d, today);
            return (
              <div key={d} className={cn("flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-sm tabular-nums", d === today && "bg-fill font-bold", m === "holiday" && "text-text-tertiary")}>
                {Number(d.slice(8))}
                <span className={cn("size-1.5 rounded-full", DOT[m], m === "half" && "bg-gradient-to-r from-warning from-50% to-fill to-50%")} />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-danger" />{t("att.legendAbsent")}</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-gradient-to-r from-warning from-50% to-fill to-50%" />{t("att.legendHalf")}</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-text-tertiary" />{t("att.legendLeave")}</span>
        </div>
      </Card>
    </>
  );
}

export default function ParentAttendance() {
  return isLive ? <AttendanceLive /> : <ParentAttendanceDemo />;
}
