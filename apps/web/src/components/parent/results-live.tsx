"use client";
import * as React from "react";
import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChild } from "@/components/parent-child";
import { Loaded, useErrText } from "@/components/parent/live-ui";
import { fetchParentReportCard, useParentReportCard, useParentResult, useParentResults, type ParentExamRow } from "@/lib/api/hooks/parent";
import { useFmt } from "@/lib/lang-context";
import { useData, useT } from "@/lib/parent-i18n";
import { downloadReportCard } from "@/lib/report-card";
import { reportCardFromApi } from "@/lib/report-card-api";

/** Report card PDF (English, as the school prints it). */
function ReportCardButton({ sid, examId }: { sid: string; examId: string }) {
  const t = useT(), err = useErrText();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant="brand" size="sm" loading={busy} onClick={async () => {
      setBusy(true);
      try { downloadReportCard(reportCardFromApi(await fetchParentReportCard(sid, examId))); toast.success(t("rc.done")); }
      catch (e) { toast.error(err(e)); } finally { setBusy(false); }
    }}>{!busy && <FileDown />}{t("res.download")}</Button>
  );
}

function ExamCard({ sid, row }: { sid: string; row: ParentExamRow }) {
  const t = useT(), dd = useData(), f = useFmt();
  const q = useParentResult(sid, row.exam.id, true);
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>{dd(row.exam.name)}</CardTitle><CardDescription>{t("res.published", { date: f.ist(row.published_at) })}</CardDescription></div>
        <div className="flex items-center gap-2.5">
          {row.percentage != null && <Badge tone={row.passed === false ? "warning" : "brand"}>{row.percentage}% · {row.grade ?? "—"}</Badge>}
          <ReportCardButton sid={sid} examId={row.exam.id} />
        </div>
      </CardHeader>
      <Loaded q={q}>
        {(r) => {
          const marks = new Map(r.marks.map((m) => [m.subject_id, m]));
          return (<>
            <Table className="min-w-0">
              <TableHeader><TableRow><TableHead>{t("res.subject")}</TableHead><TableHead className="text-right">{t("res.marks")}</TableHead><TableHead className="text-right">{t("res.grade")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {r.papers.map((p) => {
                  const m = marks.get(p.subject_id);
                  const none = !m || !m.entered;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{dd(p.subject)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m?.absent ? t("pl.absentMark") : none ? "—" : `${m.marks_obtained} / ${p.max_marks}`}</TableCell>
                      <TableCell className="text-right">{m?.absent || none ? "—" : m.grade ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow><TableCell className="font-bold">{t("res.total")}</TableCell><TableCell className="text-right font-bold tabular-nums">{r.total} / {r.max_total}</TableCell><TableCell className="text-right font-bold">{r.grade ?? ""}</TableCell></TableRow>
              </TableBody>
            </Table>
            {r.rank != null && <p className="mt-3 text-sm text-muted-foreground">{t("pl.rank", { rank: r.rank, n: r.class_size })}</p>}
            {r.remark && <p className="mt-4 rounded-xl bg-fill px-4 py-3 text-sm"><span className="text-muted-foreground">{t("res.classTeacher")}</span>{r.remark}</p>}
          </>);
        }}
      </Loaded>
    </Card>
  );
}

function Legend({ sid, examId }: { sid: string; examId: string }) {
  const t = useT();
  const q = useParentReportCard(sid, examId);
  if (!q.data?.grading.length) return null;
  const bands = [...q.data.grading].sort((a, b) => b.min_percent - a.min_percent);
  return <p className="text-xs text-text-tertiary"><span className="font-medium">{t("grade.label")}</span>{bands.map((b) => `${b.grade} ${b.min_percent}+`).join(" · ")}</p>;
}

export function ResultsLive() {
  const t = useT();
  const sel = useChild();
  const q = useParentResults(sel?.child.id ?? "");
  if (!sel) return null;
  const sid = sel.child.id;
  return (
    <>
      <PageHeader eyebrow={sel.child.name} title={t("res.title")} dim={t("res.dim")} />
      <Loaded q={q}>
        {(rows) => {
          const list = [...rows].sort((a, b) => b.published_at.localeCompare(a.published_at));
          if (!list.length) return <EmptyState icon={FileText} title={t("res.emptyTitle")} text={t("res.emptyText")} />;
          return (<>{list.map((r) => <ExamCard key={r.exam.id} sid={sid} row={r} />)}<Legend sid={sid} examId={list[0].exam.id} /></>);
        }}
      </Loaded>
    </>
  );
}
