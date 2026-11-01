"use client";
import { PageHeader } from "@/components/app/page-header";
import { GradeLegend } from "@/components/app/academic/grade-legend";
import { ReportCardButton } from "@/components/app/academic/report-card-button";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChild } from "@/components/parent-child";
import { FileText } from "lucide-react";
import { gradeFor, publicationOf, useAcademic } from "@/lib/academic-setup";
import { buildReportCardData } from "@/lib/report-card";
import { formatIST } from "@/lib/time";

export default function ParentResults() {
  const sel = useChild();
  const { exams } = useAcademic();
  if (!sel) return null;
  const published = exams
    .map((e) => ({ exam: e, pub: publicationOf(e.id, sel.child.classId) }))
    .filter((x): x is { exam: typeof x.exam; pub: NonNullable<typeof x.pub> } => !!x.pub)
    .sort((a, b) => b.pub.at.localeCompare(a.pub.at));

  return (
    <>
      <PageHeader eyebrow={sel.child.name} title="Results." dim="Published by the class teacher." />
      {published.length === 0 && <EmptyState icon={FileText} title="No results yet" text="Results appear here once the class teacher publishes them." />}
      {published.map(({ exam, pub }) => {
        const d = buildReportCardData(sel.child.id, exam.id);
        if (!d) return null;
        return (
          <Card key={exam.id}>
            <CardHeader>
              <div><CardTitle>{exam.name}</CardTitle><CardDescription>Published {formatIST(pub.at)} IST</CardDescription></div>
              <div className="flex items-center gap-2.5">
                <Badge tone={d.passed ? "brand" : "warning"}>{d.pct}% · {d.grade}</Badge>
                <ReportCardButton studentId={sel.child.id} examId={exam.id} label="Download report card" variant="brand" />
              </div>
            </CardHeader>
            <Table className="min-w-0">
              <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead className="text-right">Marks</TableHead><TableHead className="text-right">Grade</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.subjects.map((x) => <TableRow key={x.name}><TableCell className="font-medium">{x.name}</TableCell><TableCell className="text-right tabular-nums">{x.marks ?? "—"} / {x.max}</TableCell><TableCell className="text-right">{x.marks === null ? "—" : gradeFor((x.marks / x.max) * 100)}</TableCell></TableRow>)}
                <TableRow><TableCell className="font-bold">Total</TableCell><TableCell className="text-right font-bold tabular-nums">{d.total} / {d.maxTotal}</TableCell><TableCell /></TableRow>
              </TableBody>
            </Table>
            {d.remark && <p className="mt-4 rounded-xl bg-fill px-4 py-3 text-sm"><span className="text-muted-foreground">Class teacher: </span>{d.remark}</p>}
          </Card>
        );
      })}
      <GradeLegend />
    </>
  );
}
