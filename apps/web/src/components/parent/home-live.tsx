"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { SectionCard, clock12, firstName, markOf, monthOf, type Mark } from "@/components/parent/bits";
import { useParentCalendar, useParentFeedback, useParentFees, useParentLibrary, useParentTimetable } from "@/lib/api/hooks/parent";
import { useParentInbox, useParentUpdates, type ParentNotification } from "@/lib/api/hooks/parent-comms";
import { useData, useT } from "@/lib/parent-i18n";
import { useFmt } from "@/lib/lang-context";
import { formatINR, todayOnIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const TONE = { present: "success", absent: "danger", half: "warning", leave: "neutral", holiday: "neutral", none: "neutral" } as const;
const KEY = "slov.congrats.dismissed";
const EVT = "slov:congrats";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const readDismissed = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

/** The year-end promotion message, for 14 days. The wording follows the language chosen now; the class and year come from the notification. */
function CongratsLive({ studentId, name, today }: { studentId: string; name: string; today: string }) {
  const t = useT();
  const inbox = useParentInbox(false, 50);
  const raw = React.useSyncExternalStore(subscribe, readDismissed, () => "");
  let dismissed: string[] = [];
  try { dismissed = raw ? (JSON.parse(raw) as string[]) : []; } catch {}
  const n: ParentNotification | undefined = inbox.data?.items.find((x) => x.student_id === studentId && x.kind.startsWith("promotion_"));
  if (!n || dismissed.includes(n.id)) return null;
  if ((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${todayOnIST(new Date(n.created_at))}T00:00:00Z`)) / 86_400_000 > 14) return null;
  const d = (n.data ?? {}) as { class?: string | null; year?: string };
  const text = n.kind === "promotion_promoted" && d.class && d.year ? { title: t("nt.promoTitle"), body: t("nt.promoBody", { name, c: d.class, year: d.year }) }
    : n.kind === "promotion_stayed" && d.class && d.year ? { title: t("nt.stayTitle"), body: t("nt.stayBody", { name, c: d.class, year: d.year }) }
    : { title: n.title, body: n.body };
  const dismiss = () => { try { localStorage.setItem(KEY, JSON.stringify([...dismissed, n.id])); } catch {} window.dispatchEvent(new Event(EVT)); };
  return (
    <Card className="flex items-center gap-3" role="status" aria-label={t("cg.label")}>
      <p className="min-w-0 flex-1 text-sm font-medium">{text.body}</p>
      <button type="button" onClick={dismiss} aria-label={t("cg.dismiss")} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-fill"><X className="size-4" /></button>
    </Card>
  );
}

function FeedbackPrompt({ studentId }: { studentId: string }) {
  const t = useT();
  const q = useParentFeedback();
  if (!q.data?.some((r) => r.student_id === studentId && r.targets.some((x) => x.my_rating == null))) return null;
  return <Link href="/parent/feedback" className="block rounded-[20px] hover:opacity-90"><Card className="flex items-center justify-between gap-3 font-medium">{t("home.feedbackTitle")} <ArrowRight className="size-4 text-brand" /></Card></Link>;
}

export function HomeLive() {
  const t = useT(), d = useData();
  const sel = useChild();
  const today = useTodayIST();
  const sid = sel?.child.id ?? "";
  const cal = useParentCalendar(sid, today ? monthOf(today) : "");
  const fees = useParentFees(sid);
  const updates = useParentUpdates(sid);
  const tt = useParentTimetable(sid, today || undefined);
  const lib = useParentLibrary(sid);
  const f = useFmt();
  if (!sel || !today) return null;
  const { child } = sel;
  const name = firstName(child.name);
  const left = child.readOnly;
  const mark: Mark = markOf(cal.data?.days.find((x) => x.day_on === today), today);
  const nextDue = fees.data?.invoices.filter((i) => i.balance_paise > 0 && i.status !== "closed").sort((a, b) => a.due_on.localeCompare(b.due_on))[0];
  const nowIST = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }).slice(0, 5);

  return (
    <>
      <PageHeader title={t("home.title")} />
      {!left && <CongratsLive studentId={child.id} name={name} today={today} />}
      {left && <Card className="text-sm">{t("pl.leftNote", { name })}</Card>}
      {!left && <FeedbackPrompt studentId={child.id} />}
      {(lib.data?.overdue_count ?? 0) > 0 && (
        <Link href="/parent/records" className="block rounded-[20px] hover:opacity-90"><Card className="flex items-center justify-between gap-3 font-medium">{t("pl.libOverdue", { n: lib.data!.overdue_count })} <ArrowRight className="size-4 text-brand" /></Card></Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title={t("nav.attendance")} q={cal} link="/parent/attendance">
          {() => <Badge tone={TONE[mark]}>{t(`mark.${mark}`)}</Badge>}
        </SectionCard>
        <SectionCard title={t("nav.fees")} q={fees} link="/parent/fees">
          {(x) => (<>
            <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{x.due_paise > 0 ? formatINR(x.due_paise) : t("home.allPaid")}</p>
            {x.due_paise > 0 && <p className="mt-1 text-[13px] text-muted-foreground">{nextDue ? (nextDue.overdue ? t("pl.overdue") : t("home.due", { date: f.on(nextDue.due_on) })) : t("pl.previousDues")}</p>}
          </>)}
        </SectionCard>
        <SectionCard title={t("home.next")} q={tt} link="/parent/timetable">
          {(x) => {
            const rows = [...x.today].sort((a, b) => a.slot.period_number - b.slot.period_number);
            const e = rows.find((r) => r.slot.starts_at.slice(0, 5) >= nowIST) ?? rows[rows.length - 1];
            if (!e) return <p className="text-sm text-muted-foreground">{t("home.noClass")}</p>;
            return (<>
              <p className="text-[22px] font-bold leading-tight">{d(e.slot.subject_name)}</p>
              <p className="mt-1 text-[13px] tabular-nums text-muted-foreground">{clock12(e.slot.starts_at)}</p>
            </>);
          }}
        </SectionCard>
        <SectionCard title={t("home.notice")} q={updates} link="/parent/notices">
          {(p) => {
            const n = p.items[0];
            if (!n) return <p className="text-sm text-muted-foreground">{t("upd.none")}</p>;
            return <p className="line-clamp-2 font-medium">{n.title}</p>;
          }}
        </SectionCard>
      </div>
    </>
  );
}
