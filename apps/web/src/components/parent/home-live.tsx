"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, GraduationCap, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { SectionCard, clock12, firstName, markOf, monthOf, type Mark } from "@/components/parent/bits";
import { useParentCalendar, useParentChildren, useParentDateSheet, useParentFeedback, useParentFees, useParentLibrary, useParentResults, useParentTimetable } from "@/lib/api/hooks/parent";
import { useParentInbox, useParentUpdates, type ParentNotification } from "@/lib/api/hooks/parent-comms";
import { useData, useT } from "@/lib/parent-i18n";
import { useFmt } from "@/lib/lang-context";
import { formatINR, todayOnIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const TONE = { present: "success", absent: "danger", half: "warning", leave: "neutral", holiday: "neutral", none: "neutral" } as const;
const KEY = "scool.congrats.dismissed";
const EVT = "scool:congrats";
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
    <Card className="flex items-start gap-4 bg-accent-subtle" role="status" aria-label={t("cg.label")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-brand"><GraduationCap className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="font-bold">{text.title}</p><p className="text-sm text-muted-foreground">{text.body}</p></div>
      <button type="button" onClick={dismiss} aria-label={t("cg.dismiss")} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-card"><X className="size-4" /></button>
    </Card>
  );
}

function FeedbackPrompt({ studentId }: { studentId: string }) {
  const t = useT();
  const q = useParentFeedback();
  if (!q.data?.some((r) => r.student_id === studentId && r.targets.some((x) => x.my_rating == null))) return null;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 bg-accent-subtle">
      <div><p className="font-bold">{t("home.feedbackTitle")}</p><p className="text-sm text-muted-foreground">{t("home.feedbackText")}</p></div>
      <Link href="/parent/feedback" className="flex items-center gap-1 text-sm font-medium text-brand">{t("home.feedbackCta")} <ArrowRight className="size-4" /></Link>
    </Card>
  );
}

export function HomeLive() {
  const t = useT(), d = useData(), f = useFmt();
  const sel = useChild();
  const today = useTodayIST();
  const sid = sel?.child.id ?? "";
  const kids = useParentChildren();
  const cal = useParentCalendar(sid, today ? monthOf(today) : "");
  const fees = useParentFees(sid);
  const results = useParentResults(sid);
  const updates = useParentUpdates(sid);
  const tt = useParentTimetable(sid, today || undefined);
  const sheets = useParentDateSheet(sid);
  const lib = useParentLibrary(sid);
  if (!sel || !today) return null;
  const { child } = sel;
  const name = firstName(child.name);
  const info = kids.data?.find((c) => c.student_id === child.id);
  const left = child.readOnly;

  const mark: Mark = markOf(cal.data?.days.find((x) => x.day_on === today), today);
  const pct = cal.data?.stats.percentage;
  const papers = (sheets.data ?? []).flatMap((s) => s.items.filter((p) => p.paper_on >= today).map((p) => ({ ...p, sheet: s.name }))).sort((a, b) => `${a.paper_on}${a.starts_at}`.localeCompare(`${b.paper_on}${b.starts_at}`));
  const nextDue = fees.data?.invoices.filter((i) => i.balance_paise > 0 && i.status !== "closed").sort((a, b) => a.due_on.localeCompare(b.due_on))[0];

  return (
    <>
      <PageHeader eyebrow={info?.roll_no ? t("home.eyebrow", { c: child.classLabel, r: info.roll_no }) : t("hdr.class", { c: child.classLabel })} title={t("home.title", { name })} dim={left ? t("home.dimLeft") : t("home.dimDefault")} />
      {!left && <CongratsLive studentId={child.id} name={name} today={today} />}
      {left && <Card className="bg-accent-subtle text-sm">{t("pl.homeLeft", { name })}</Card>}
      {!left && <FeedbackPrompt studentId={child.id} />}
      {(lib.data?.overdue_count ?? 0) > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-accent-subtle">
          <p className="text-sm font-medium">{t("pl.libOverdue", { n: lib.data!.overdue_count })}</p>
          <Link href="/parent/records" className="flex items-center gap-1 text-sm font-medium text-brand">{t("pl.libView")} <ArrowRight className="size-4" /></Link>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title={t("home.today")} q={cal} link="/parent/attendance" linkKey="home.attendanceLink" aside={<span className="text-[13px] text-muted-foreground">{f.on(today, "short")}</span>}>
          {() => (<>
            <Badge tone={TONE[mark]}>{t(`mark.${mark}`)}</Badge>
            <p className="mt-3 text-[13px] text-muted-foreground">{pct != null ? t("pl.monthPct", { pct }) : t("pl.monthNone")}</p>
          </>)}
        </SectionCard>
        <SectionCard title={t("home.fees")} q={fees} link="/parent/fees" linkKey="home.feeDetails">
          {(x) => (<>
            <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{x.due_paise > 0 ? formatINR(x.due_paise) : t("home.allPaid")}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{x.due_paise > 0 ? (nextDue ? t("home.due", { date: f.on(nextDue.due_on), status: nextDue.overdue ? t("pl.overdue") : t(`inv.${nextDue.status === "paid" ? "paid" : nextDue.status === "partial" ? "partial" : "unpaid"}`) }) : t("pl.previousDues")) : t("home.nothingPending")}</p>
          </>)}
        </SectionCard>
        <SectionCard title={t("home.latestResult")} q={results} link="/parent/results" linkKey="home.allResults">
          {(rows) => {
            const r = [...rows].sort((a, b) => b.published_at.localeCompare(a.published_at))[0];
            if (!r) return <p className="text-sm text-muted-foreground">{t("res.emptyTitle")}</p>;
            return (<>
              <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{r.percentage != null ? `${r.percentage}%` : "—"} <span className="text-lg text-muted-foreground">{r.grade ?? ""}</span></p>
              <p className="mt-1 text-[13px] text-muted-foreground">{d(r.exam.name)} · {f.ist(r.published_at, "date")}</p>
            </>);
          }}
        </SectionCard>
        <SectionCard title={t("home.latestNotice")} q={updates} link="/parent/notices" linkKey="home.allNotices">
          {(p) => {
            const n = p.items[0];
            if (!n) return <p className="text-sm text-muted-foreground">{t("upd.none")}</p>;
            return (<>
              <p className="font-medium">{n.title}</p>
              <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[13px] text-text-tertiary">{f.ist(n.created_at)} IST</p>
            </>);
          }}
        </SectionCard>
        <SectionCard title={t("pl.todayClasses")} q={tt} link="/parent/timetable" linkKey="pl.fullTimetable">
          {(x) => {
            const rows = [...x.today].sort((a, b) => a.slot.period_number - b.slot.period_number);
            if (!rows.length) return <p className="text-sm text-muted-foreground">{t("pl.noClassesToday")}</p>;
            return (
              <ul className="flex flex-col">
                {rows.map((e) => (
                  <li key={e.slot.id} className="flex items-baseline justify-between gap-3 border-t border-border py-2 text-sm first:border-t-0 first:pt-0">
                    <span className="min-w-0"><span className="block font-medium">{d(e.slot.subject_name)}</span>
                      <span className={e.substitute_name ? "block truncate text-xs text-muted-foreground line-through opacity-60" : "block truncate text-xs text-muted-foreground"}>{e.teacher_name}</span>
                      {e.substitute_name && <span className="block truncate text-xs font-medium text-brand">{t("tt.sub", { name: e.substitute_name })}</span>}</span>
                    <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{clock12(e.slot.starts_at)}</span>
                  </li>
                ))}
              </ul>
            );
          }}
        </SectionCard>
        <SectionCard title={t("pl.upcomingExams")} q={sheets} link="/parent/notices" linkKey="nt.dateSheet">
          {() => papers.length === 0 ? <p className="text-sm text-muted-foreground">{t("pl.noExams")}</p> : (
            <ul className="flex flex-col">
              {papers.slice(0, 4).map((p) => (
                <li key={`${p.class_id}${p.subject_id}${p.paper_on}`} className="flex items-baseline justify-between gap-3 border-t border-border py-2 text-sm first:border-t-0 first:pt-0">
                  <span className="min-w-0"><span className="block font-medium">{d(p.subject)}</span><span className="block truncate text-xs text-muted-foreground">{d(p.sheet)}</span></span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-text-tertiary">{f.on(p.paper_on, "short")}<br />{clock12(p.starts_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
