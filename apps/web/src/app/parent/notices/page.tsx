"use client";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { HOLIDAYS, NOTICES } from "@/lib/mock";
import { formatDateOn, formatIST } from "@/lib/time";
import { useChild } from "@/components/parent-child";
import { clock, useExamSheets } from "@/lib/exam-sheets";

const KIND = { holiday: "danger", exam: "warning", event: "brand" } as const;

export default function ParentNotices() {
  const sel = useChild();
  const sheets = useExamSheets().filter((s) => sel && s.classIds.includes(sel.child.classId));
  return (
    <>
      <PageHeader title="Notices." dim="And the school calendar." />
      {sheets.map((es) => (
        <Card key={es.id}>
          <CardHeader><CardTitle>{es.name}</CardTitle><Badge tone="warning">Date sheet</Badge></CardHeader>
          <ul>{es.papers.map((p) => <li key={p.subject} className="flex items-center justify-between border-t border-border py-3 text-sm first:border-t-0 first:pt-0 last:pb-0"><span className="font-medium">{p.subject}</span><span className="tabular-nums text-muted-foreground">{formatDateOn(p.dateOn, "weekday").split(",")[0]}, {formatDateOn(p.dateOn, "short")} · {clock(p.time)}</span></li>)}</ul>
        </Card>
      ))}
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Notices</CardTitle></CardHeader>
          <ul>
            {NOTICES.filter((n) => n.audience !== "staff").map((n) => (
              <li key={n.id} className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
                <p className="font-medium">{n.title}</p><p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs tabular-nums text-text-tertiary">{formatIST(n.publishedAt)} IST</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader><CardTitle>Calendar</CardTitle></CardHeader>
          <ul>
            {HOLIDAYS.map((h) => (
              <li key={h.id} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1"><p className="font-medium">{h.title}</p><p className="text-xs tabular-nums text-muted-foreground">{formatDateOn(h.fromOn, "short")}{h.toOn !== h.fromOn && ` – ${formatDateOn(h.toOn, "short")}`}</p></div>
                <Badge tone={KIND[h.kind as keyof typeof KIND]} className="capitalize">{h.kind}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
