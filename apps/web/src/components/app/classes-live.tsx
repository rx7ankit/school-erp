"use client";
import * as React from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { Can, useCan } from "@/components/app/can";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorBlock, classLabel, noCurrentYear } from "@/components/app/academic-live-ui";
import { PageHeader } from "@/components/app/page-header";
import { useSession } from "@/components/session-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Appear, Skeleton, SkTableRows } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAssignmentRows, useClasses, useSubjects } from "@/lib/api/hooks/academic";
import { useRolloverStatus } from "@/lib/api/hooks/rollover";
import { useStudentList } from "@/lib/api/hooks/students";
import type { ClassOut } from "@/lib/api/types";
import { formatDateOn } from "@/lib/time";

/** "Session ends on ...  Start year-end", from the API's own 45-day rule. */
export function LiveYearEndBanner() {
  const can = useCan();
  const st = useRolloverStatus(can("academic.manage"));
  const s = st.data;
  if (!can("academic.manage") || !s || !(s.show_banner || s.has_draft) || s.already_applied) return null;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
      <p className="font-bold">{s.current_year} ends {s.ends_on ? formatDateOn(s.ends_on, "short") : "—"}</p>
      <Button asChild variant="brand"><Link href="/promotion">{s.has_draft ? "Continue" : "Year-end"}</Link></Button>
    </Card>
  );
}

function Roster({ c, onClose }: { c: ClassOut | null; onClose: () => void }) {
  const students = useStudentList({ class_id: c?.id, status: "active", limit: 200 });
  const assigns = useAssignmentRows(!!c);
  const subjects = useSubjects();
  const subj = new Map((subjects.data?.items ?? []).map((s) => [s.id, s.name]));
  const teachers = (assigns.data?.items ?? []).filter((a) => a.class_id === c?.id);
  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Class {c ? classLabel(c) : ""}</DialogTitle><DialogDescription>{c?.students ?? 0} students</DialogDescription></DialogHeader>
        <div className="flex max-h-[65dvh] flex-col gap-6 overflow-y-auto">
          <section>
            <h3 className="mb-2 text-sm font-bold">Teachers</h3>
            {assigns.isPending ? <div role="status" aria-busy="true" className="flex flex-col gap-1.5"><span className="sr-only">Loading</span>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[52px] rounded-xl" />)}</div> : assigns.isError ? <ErrorBlock error={assigns.error} onRetry={() => assigns.refetch()} /> : teachers.length === 0 ? <p className="text-sm text-muted-foreground">No teachers.</p> : (
              <ul className="flex flex-col gap-1.5">{teachers.map((t) => (
                <li key={`${t.staff_id}-${t.subject_id ?? "ct"}`} className="flex items-center gap-3 rounded-xl bg-fill px-3 py-2 text-sm"><Avatar name={t.staff_name} /><span className="flex-1 font-medium">{t.staff_name}</span>
                  <Badge tone={t.role === "class_teacher" ? "brand" : "neutral"}>{t.role === "class_teacher" ? "Class teacher" : subj.get(t.subject_id ?? "") ?? "Subject"}</Badge></li>
              ))}</ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-bold">Students</h3>
            {students.isPending ? (
              <div role="status" aria-busy="true"><span className="sr-only">Loading</span>
                <Table>
                  <TableHeader><TableRow><TableHead>Roll</TableHead><TableHead>Student</TableHead><TableHead>Guardian</TableHead></TableRow></TableHeader>
                  <TableBody><SkTableRows rows={5} cols={3} /></TableBody>
                </Table>
              </div>
            ) : students.isError ? <ErrorBlock error={students.error} onRetry={() => students.refetch()} /> : students.data.items.length === 0 ? <p className="text-sm text-muted-foreground">No students.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Roll</TableHead><TableHead>Student</TableHead><TableHead>Guardian</TableHead></TableRow></TableHeader>
                <TableBody>{students.data.items.map((s) => (
                  <TableRow key={s.id}><TableCell className="tabular-nums">{s.roll_no ?? "—"}</TableCell><TableCell><Link href={`/students/${s.id}`} className="font-medium hover:underline">{s.name}</Link><p className="text-xs text-text-tertiary">{s.scholar_no}</p></TableCell><TableCell>{s.guardian_name ?? "—"}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const HEAD = (
  <TableHeader>
    <TableRow>
      <TableHead>Class</TableHead><TableHead>Class teacher</TableHead><TableHead>Teachers</TableHead>
      <TableHead className="text-right">Students</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
    </TableRow>
  </TableHeader>
);

export function ClassesLive() {
  const { me } = useSession();
  const classes = useClasses();
  const assigns = useAssignmentRows();
  const [open, setOpen] = React.useState<ClassOut | null>(null);
  const mine = new Set((me?.assignments ?? []).map((a) => a.class_id));

  return (
    <>
      <PageHeader title="Classes" />
      <LiveYearEndBanner />
      {classes.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading</span>
          <Table className="min-w-[720px]">{HEAD}<TableBody><SkTableRows rows={8} cols={5} /></TableBody></Table>
        </div>
      ) : classes.isError ? (
        noCurrentYear(classes.error) ? <EmptyState icon={Layers} title="No academic year" action={<Can access="academic.manage"><Button asChild variant="brand"><Link href="/academic">Set up</Link></Button></Can>} />
          : <ErrorBlock error={classes.error} onRetry={() => classes.refetch()} />
      ) : classes.data.items.length === 0 ? (
        <EmptyState icon={Layers} title="No classes" action={<Can access="academic.manage"><Button asChild variant="brand"><Link href="/academic">Add classes</Link></Button></Can>} />
      ) : (
        <Appear>
          <Table className="min-w-[720px]">
            {HEAD}
            <TableBody>
              {classes.data.items.map((c) => {
                const rows = (assigns.data?.items ?? []).filter((a) => a.class_id === c.id);
                const ct = rows.find((a) => a.role === "class_teacher");
                const teacherCount = new Set(rows.map((a) => a.staff_id)).size;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[17px] font-bold tracking-tight">{classLabel(c)}</span>
                        {mine.has(c.id) && <Badge tone="brand">Yours</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ct ? <div className="flex items-center gap-2.5"><Avatar name={ct.staff_name} /><span className="font-medium">{ct.staff_name}</span></div>
                        : <span className="text-text-tertiary">None</span>}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{assigns.isPending ? <Skeleton className="h-3.5 w-6" /> : teacherCount}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{c.students}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Can access="academic.manage"><Link href="/promotion" className="text-[13px] font-medium text-text-secondary hover:text-foreground hover:underline" aria-label={`Promote class ${classLabel(c)}`}>Promote</Link></Can>
                        <Button variant="secondary" size="sm" onClick={() => setOpen(c)}>Open</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Appear>
      )}
      <Roster c={open} onClose={() => setOpen(null)} />
    </>
  );
}
