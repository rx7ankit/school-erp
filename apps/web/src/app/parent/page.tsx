"use client";
import { isLive } from "@/lib/api/config";
import { HomeLive } from "@/components/parent/home-live";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge as Badge } from "@/components/parent/status-badge";
import * as React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { CongratsCard } from "@/components/app/rollover/parent-congrats";
import { NOTICES } from "@/lib/mock";
import { FEEDBACK_REQUESTS } from "@/lib/feedback-mock";
import { gradeOf, invoiceFor, markFor, resultsFor } from "@/lib/parent-data";
import { formatINR } from "@/lib/time";
import { useData, useT } from "@/lib/parent-i18n";
import { useFmt } from "@/lib/lang-context";
import { useTodayIST } from "@/lib/use-today";

const TONE = { present: "success", absent: "danger", half: "warning", leave: "neutral", holiday: "neutral", none: "neutral" } as const;

function Tile({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return <Link href={href} className="block rounded-[20px] hover:opacity-90"><Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader>{children}</Card></Link>;
}

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
      <PageHeader title={t("home.title")} />
      {!left && <CongratsCard studentId={child.id} />}
      {left && <Card className="text-sm">{t("pl.leftNote", { name: child.name.split(" ")[0] })}</Card>}
      {pendingFeedback && <Link href="/parent/feedback" className="block rounded-[20px] hover:opacity-90"><Card className="flex items-center justify-between gap-3 font-medium">{t("home.feedbackTitle")} <ArrowRight className="size-4 text-text-tertiary" /></Card></Link>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Tile href="/parent/attendance" title={t("nav.attendance")}><Badge tone={TONE[mark]}>{t(`mark.${mark}`)}</Badge></Tile>
        <Tile href="/parent/fees" title={t("nav.fees")}>
          <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{due > 0 ? formatINR(due) : t("home.allPaid")}</p>
          {inv && due > 0 && <p className="mt-1 text-[13px] text-muted-foreground">{t("home.due", { date: f.on(inv.dueOn) })}</p>}
        </Tile>
        <Tile href="/parent/results" title={t("home.result")}>
          <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{res.pct}% <span className="text-lg text-muted-foreground">{gradeOf(res.pct)}</span></p>
          <p className="mt-1 text-[13px] text-muted-foreground">{d(res.exam)}</p>
        </Tile>
        <Tile href="/parent/notices" title={t("home.notice")}><p className="font-medium">{d(NOTICES[0].title)}</p></Tile>
      </div>
    </>
  );
}

export default function ParentHome() {
  return isLive ? <HomeLive /> : <ParentHomeDemo />;
}
