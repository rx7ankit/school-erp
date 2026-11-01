"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { NOTICES, className, invoiceStatus } from "@/lib/mock";
import { gradeOf, invoiceFor, markFor, resultsFor } from "@/lib/parent-data";
import { formatDateOn, formatINR, formatIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const TODAY = { present: ["Present", "success"], absent: ["Absent", "danger"], half: ["Half day", "warning"], leave: ["On leave", "neutral"], holiday: ["No school today", "neutral"], none: ["Not marked yet", "neutral"] } as const;

export default function ParentHome() {
  const sel = useChild();
  const today = useTodayIST();
  if (!sel) return null;
  const { child } = sel;
  const mark = today ? markFor(child.id, today, today) : "none";
  const inv = invoiceFor(child);
  const due = inv ? inv.totalPaise - inv.paidPaise : 0;
  const res = resultsFor(child)[0];
  const left = child.status !== "active";

  return (
    <>
      <PageHeader eyebrow={`Class ${className(child.classId)} · Roll ${child.rollNo}`} title={`${child.name.split(" ")[0]}'s school day.`} dim={left ? "Records are read-only." : "Everything in one place."} />
      {left && <Card className="bg-accent-subtle text-sm">{child.name.split(" ")[0]} left school on {formatDateOn(child.leftOn!)}. Past records stay here. Messaging is off.</Card>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Today</CardTitle>{today && <span className="text-[13px] text-muted-foreground">{formatDateOn(today, "short")}</span>}</CardHeader>
          <Badge tone={TODAY[mark][1]}>{TODAY[mark][0]}</Badge>
          <Link href="/parent/attendance" className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">Attendance <ArrowRight className="size-4" /></Link>
        </Card>
        <Card>
          <CardHeader><CardTitle>Fees</CardTitle></CardHeader>
          <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{due > 0 ? formatINR(due) : "All paid"}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{inv && due > 0 ? `Due ${formatDateOn(inv.dueOn)} · ${invoiceStatus(inv)}` : "Nothing is pending."}</p>
          <Link href="/parent/fees" className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">Fee details <ArrowRight className="size-4" /></Link>
        </Card>
        <Card>
          <CardHeader><CardTitle>Latest result</CardTitle></CardHeader>
          <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{res.pct}% <span className="text-lg text-muted-foreground">{gradeOf(res.pct)}</span></p>
          <p className="mt-1 text-[13px] text-muted-foreground">{res.exam} · {formatIST(res.publishedAt, "date")}</p>
          <Link href="/parent/results" className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">All results <ArrowRight className="size-4" /></Link>
        </Card>
        <Card>
          <CardHeader><CardTitle>Latest notice</CardTitle></CardHeader>
          <p className="font-medium">{NOTICES[0].title}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{formatIST(NOTICES[0].publishedAt)} IST</p>
          <Link href="/parent/notices" className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">All notices <ArrowRight className="size-4" /></Link>
        </Card>
      </div>
    </>
  );
}
