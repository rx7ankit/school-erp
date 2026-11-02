"use client";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { HOLIDAYS, NOTICES } from "@/lib/mock";
import { useFmt } from "@/lib/lang-context";
import { useData, useT } from "@/lib/parent-i18n";
import { useChild } from "@/components/parent-child";
import { clock, useExamSheets } from "@/lib/exam-sheets";

const KIND = { holiday: "danger", exam: "warning", event: "brand" } as const;

export default function ParentNotices() {
  const t = useT(), d = useData(), f = useFmt();
  const sel = useChild();
  const sheets = useExamSheets().filter((s) => sel && s.classIds.includes(sel.child.classId));
  return (
    <>
      <PageHeader title={t("nt.title")} dim={t("nt.dim")} />
      {sheets.map((es) => (
        <Card key={es.id}>
          <CardHeader><CardTitle>{d(es.name)}</CardTitle><Badge tone="warning">{t("nt.dateSheet")}</Badge></CardHeader>
          <ul>{es.papers.map((p) => <li key={p.subject} className="flex items-center justify-between border-t border-border py-3 text-sm first:border-t-0 first:pt-0 last:pb-0"><span className="font-medium">{d(p.subject)}</span><span className="tabular-nums text-muted-foreground">{f.on(p.dateOn, "weekday").split(",")[0]}, {f.on(p.dateOn, "short")} · {clock(p.time)}</span></li>)}</ul>
        </Card>
      ))}
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>{t("nt.notices")}</CardTitle></CardHeader>
          <ul>
            {NOTICES.filter((n) => n.audience !== "staff").map((n) => (
              <li key={n.id} className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
                <p className="font-medium">{d(n.title)}</p><p className="mt-1 text-sm text-muted-foreground">{d(n.body)}</p>
                <p className="mt-1 text-xs tabular-nums text-text-tertiary">{f.ist(n.publishedAt)} IST</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("nt.calendar")}</CardTitle></CardHeader>
          <ul>
            {HOLIDAYS.map((h) => (
              <li key={h.id} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1"><p className="font-medium">{d(h.title)}</p><p className="text-xs tabular-nums text-muted-foreground">{f.on(h.fromOn, "short")}{h.toOn !== h.fromOn && ` – ${f.on(h.toOn, "short")}`}</p></div>
                <Badge tone={KIND[h.kind as keyof typeof KIND]}>{t(`kind.${h.kind as keyof typeof KIND}`)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
