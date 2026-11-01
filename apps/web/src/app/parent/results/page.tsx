"use client";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChild } from "@/components/parent-child";
import { gradeOf, resultsFor } from "@/lib/parent-data";
import { formatIST } from "@/lib/time";

export default function ParentResults() {
  const sel = useChild();
  if (!sel) return null;
  return (
    <>
      <PageHeader eyebrow={sel.child.name} title="Results." dim="Published by the class teacher." />
      {resultsFor(sel.child).map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <div><CardTitle>{r.exam}</CardTitle><CardDescription>Published {formatIST(r.publishedAt)} IST</CardDescription></div>
            <Badge tone="brand">{r.pct}% · {gradeOf(r.pct)}</Badge>
          </CardHeader>
          <Table className="min-w-0">
            <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead className="text-right">Marks</TableHead><TableHead className="text-right">Grade</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.subjects.map((x) => <TableRow key={x.name}><TableCell className="font-medium">{x.name}</TableCell><TableCell className="text-right tabular-nums">{x.marks} / {x.max}</TableCell><TableCell className="text-right">{gradeOf(x.marks)}</TableCell></TableRow>)}
              <TableRow><TableCell className="font-bold">Total</TableCell><TableCell className="text-right font-bold tabular-nums">{r.total} / {r.max}</TableCell><TableCell /></TableRow>
            </TableBody>
          </Table>
          <p className="mt-4 rounded-xl bg-fill px-4 py-3 text-sm"><span className="text-muted-foreground">Class teacher: </span>{r.remark}</p>
        </Card>
      ))}
    </>
  );
}
