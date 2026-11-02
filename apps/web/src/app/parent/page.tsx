"use client";
import { isLive } from "@/lib/api/config";
import { HomeLive } from "@/components/parent/home-live";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { CongratsCard } from "@/components/app/rollover/parent-congrats";
import { NOTICES, className, invoiceStatus } from "@/lib/mock";
import { FEEDBACK_REQUESTS } from "@/lib/feedback-mock";
import { gradeOf, invoiceFor, markFor, resultsFor } from "@/lib/parent-data";
import { formatINR } from "@/lib/time";
import { useData, useT } from "@/lib/parent-i18n";
import { useFmt } from "@/lib/lang-context";
import { useTodayIST } from "@/lib/use-today";

const TONE = { present: "success", absent: "danger", half: "warning", leave: "neutral", holiday: "neutral", none: "neutral" } as const;

function ParentHomeDemo() {
  const t = useT(), d = useData(), f = useFmt();
  const sel = useChild();
  const today = useTodayIST();
  if (!sel) return null;
  const { child } = sel;
  const mark = today ? markFor(child.id, today, today) : "none";
  const inv = invoiceFor(child);
  const due = inv ? inv.totalPaise - inv.paidPaise : 0;
  const res = resultsFor(child)[0];
  const left = child.status !== "active";
  const pendingFeedback = !left && FEEDBACK_REQUESTS.some((r) => r.status === "open" && r.classIds.includes(child.classId));

  return (
    <>
      <PageHeader eyebrow={t("home.eyebrow", { c: className(child.classId), r: child.rollNo })} title={t("home.title", { name: child.name.split(" ")[0] })} dim={left ? t("home.dimLeft") : t("home.dimDefault")} />
      {!left && <CongratsCard studentId={child.id} />}
      {left && <Card className="bg-accent-subtle text-sm">{t("home.left", { name: child.name.split(" ")[0], date: f.on(child.leftOn!) })}</Card>}
      {pendingFeedback && (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-accent-subtle">
          <div><p className="font-bold">{t("home.feedbackTitle")}</p><p className="text-sm text-muted-foreground">{t("home.feedbackText")}</p></div>
          <Link href="/parent/feedback" className="flex items-center gap-1 text-sm font-medium text-brand">{t("home.feedbackCta")} <ArrowRight className="size-4" /></Link>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("home.today")}</CardTitle>{today && <span className="text-[13px] text-muted-foreground">{f.on(today, "short")}</span>}</CardHeader>
          <Badge tone={TONE[mark]}>{t(`mark.${mark}`)}</Badge>
          <Link href="/parent/attendance" className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">{t("home.attendanceLink")} <ArrowRight className="size-4" /></Link>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("home.fees")}</CardTitle></CardHeader>
          <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{due > 0 ? formatINR(due) : t("home.allPaid")}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{inv && due > 0 ? t("home.due", { date: f.on(inv.dueOn), status: t(`inv.${invoiceStatus(inv)}`) }) : t("home.nothingPending")}</p>
          <Link href="/parent/fees" className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">{t("home.feeDetails")} <ArrowRight className="size-4" /></Link>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("home.latestResult")}</CardTitle></CardHeader>
          <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{res.pct}% <span className="text-lg text-muted-foreground">{gradeOf(res.pct)}</span></p>
          <p className="mt-1 text-[13px] text-muted-foreground">{d(res.exam)} · {f.ist(res.publishedAt, "date")}</p>
          <Link href="/parent/results" className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">{t("home.allResults")} <ArrowRight className="size-4" /></Link>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("home.latestNotice")}</CardTitle></CardHeader>
          <p className="font-medium">{d(NOTICES[0].title)}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{f.ist(NOTICES[0].publishedAt)} IST</p>
          <Link href="/parent/notices" className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">{t("home.allNotices")} <ArrowRight className="size-4" /></Link>
        </Card>
      </div>
    </>
  );
}

export default function ParentHome() {
  return isLive ? <HomeLive /> : <ParentHomeDemo />;
}
