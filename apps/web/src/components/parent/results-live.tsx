"use client";
import * as React from "react";
import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge as Badge } from "@/components/parent/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkTableRows, Skeleton } from "@/components/ui/skeleton";
import { useChild } from "@/components/parent-child";
import { Loaded, ParentSk, useErrText } from "@/components/parent/live-ui";
import { fetchParentReportCard, useParentResult, useParentResults, type ParentExamRow } from "@/lib/api/hooks/parent";
import { useFmt } from "@/lib/lang-context";
import { useData, useT } from "@/lib/parent-i18n";
import { downloadReportCard } from "@/lib/report-card";
import { reportCardFromApi } from "@/lib/report-card-api";

/** Report card PDF (English, as the school prints it). */
function ReportCardButton({ sid, examId }: { sid: string; examId: string }) {
  const t = useT(), err = useErrText();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button variant="default" size="sm" loading={busy} onClick={async () => {
      setBusy(true);
      try { downloadReportCard(reportCardFromApi(await fetchParentReportCard(sid, examId))); toast.success(t("rc.done")); }
      catch (e) { toast.error(err(e)); } finally { setBusy(false); }
    }}>{!busy && <FileDown />}{t("res.download")}</Button>
  );
}

/** The marks table with its real headings and placeholder rows. */
function MarksSk() {
  const t = useT();
  return (
    <Table className="min-w-0">
      <TableHeader><TableRow><TableHead>{t("res.subject")}</TableHead><TableHead className="text-right">{t("res.marks")}</TableHead><TableHead className="text-right">{t("res.grade")}</TableHead></TableRow></TableHeader>
      <TableBody><SkTableRows rows={6} cols={3} /></TableBody>
    </Table>
  );
}

function ResultsSk() {
  return (
    <ParentSk>
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div><Skeleton className="h-5 w-40" /><Skeleton className="mt-2 h-3 w-24" /></div>
            <div className="flex items-center gap-2.5"><Skeleton className="h-7 w-24 rounded-full" /><Skeleton className="h-9 w-36 rounded-full" /></div>
          </CardHeader>
          <MarksSk />
        </Card>
      ))}
    </ParentSk>
  );
}

function ExamCard({ sid, row }: { sid: string; row: ParentExamRow }) {
  const t = useT(), dd = useData(), f = useFmt();
  const q = useParentResult(sid, row.exam.id, true);
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>{dd(row.exam.name)}</CardTitle><CardDescription>{f.ist(row.published_at, "date")}</CardDescription></div>
        <div className="flex items-center gap-2.5">
          {row.percentage != null && <Badge tone={row.passed === false ? "warning" : "success"}>{row.percentage}% · {row.grade ?? "—"}</Badge>}
          <ReportCardButton sid={sid} examId={row.exam.id} />
        </div>
      </CardHeader>
      <Loaded q={q} loading={<MarksSk />}>
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

export function ResultsLive() {
  const t = useT();
  const sel = useChild();
  const q = useParentResults(sel?.child.id ?? "");
  if (!sel) return null;
  const sid = sel.child.id;
  return (
    <>
      <PageHeader title={t("res.title")} />
      <Loaded q={q} loading={<ResultsSk />} className="flex flex-col gap-6">
        {(rows) => {
          const list = [...rows].sort((a, b) => b.published_at.localeCompare(a.published_at));
          if (!list.length) return <EmptyState icon={FileText} title={t("res.emptyTitle")} />;
          return (<>{list.map((r) => <ExamCard key={r.exam.id} sid={sid} row={r} />)}</>);
        }}
      </Loaded>
    </>
  );
}
