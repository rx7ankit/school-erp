"use client";
import * as React from "react";
import Link from "next/link";
import { GraduationCap, Layers } from "lucide-react";
import { Can, useCan } from "@/components/app/can";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorBlock, LoadingBlock, classLabel, noCurrentYear } from "@/components/app/academic-live-ui";
import { PageHeader } from "@/components/app/page-header";
import { useSession } from "@/components/session-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAssignmentRows, useClasses, useSubjects, useYears } from "@/lib/api/hooks/academic";
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
    <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-accent-subtle p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-brand"><GraduationCap className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">Session {s.current_year} ends on {s.ends_on ? formatDateOn(s.ends_on, "short") : "—"}.</p>
        <p className="text-sm text-muted-foreground">{s.has_draft ? "Your year-end draft is waiting for you." : s.days_left != null && s.days_left >= 0 ? `${s.days_left} days left. Move everyone up in a few calm steps.` : "Move everyone up in a few calm steps."}</p>
      </div>
      <Button asChild variant="brand"><Link href="/promotion">{s.has_draft ? "Continue year-end" : "Start year-end"}</Link></Button>
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
        <DialogHeader><DialogTitle>Class {c ? classLabel(c) : ""}</DialogTitle><DialogDescription>{c?.students ?? 0} students · capacity {c?.capacity}</DialogDescription></DialogHeader>
        <div className="flex max-h-[65dvh] flex-col gap-6 overflow-y-auto">
          <section>
            <h3 className="mb-2 text-sm font-bold">Teachers</h3>
            {assigns.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : assigns.isError ? <ErrorBlock error={assigns.error} onRetry={() => assigns.refetch()} /> : teachers.length === 0 ? <p className="text-sm text-muted-foreground">No teacher is assigned yet.</p> : (
              <ul className="flex flex-col gap-1.5">{teachers.map((t) => (
                <li key={`${t.staff_id}-${t.subject_id ?? "ct"}`} className="flex items-center gap-3 rounded-xl bg-fill px-3 py-2 text-sm"><Avatar name={t.staff_name} /><span className="flex-1 font-medium">{t.staff_name}</span>
                  <Badge tone={t.role === "class_teacher" ? "brand" : "neutral"}>{t.role === "class_teacher" ? "Class teacher" : subj.get(t.subject_id ?? "") ?? "Subject teacher"}</Badge></li>
              ))}</ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-bold">Students</h3>
            {students.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : students.isError ? <ErrorBlock error={students.error} onRetry={() => students.refetch()} /> : students.data.items.length === 0 ? <p className="text-sm text-muted-foreground">No students in this class yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Roll</TableHead><TableHead>Student</TableHead><TableHead>Guardian</TableHead></TableRow></TableHeader>
                <TableBody>{students.data.items.map((s) => (
                  <TableRow key={s.id}><TableCell className="tabular-nums">{s.roll_no ?? "—"}</TableCell><TableCell><Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link><p className="text-xs text-text-tertiary">{s.scholar_no}</p></TableCell><TableCell>{s.guardian_name ?? "—"}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClassesLive() {
  const { me } = useSession();
  const years = useYears();
  const classes = useClasses();
  const assigns = useAssignmentRows();
  const [open, setOpen] = React.useState<ClassOut | null>(null);
  const year = years.data?.items.find((y) => y.status === "current");
  const mine = new Set((me?.assignments ?? []).map((a) => a.class_id));

  return (
    <>
      <PageHeader eyebrow={year ? `Academic year ${year.name}` : "Academic year"} title="Classes." dim="Teachers and strength." />
      <LiveYearEndBanner />
      {classes.isPending ? <LoadingBlock label="Loading classes" /> : classes.isError ? (
        noCurrentYear(classes.error) ? <EmptyState icon={Layers} title="No current academic year" text="Set up a year and its classes in Academic first." action={<Can access="academic.manage"><Button asChild variant="brand"><Link href="/academic">Open Academic</Link></Button></Can>} />
          : <ErrorBlock error={classes.error} onRetry={() => classes.refetch()} />
      ) : classes.data.items.length === 0 ? (
        <EmptyState icon={Layers} title="No classes yet" text="Add classes for this year in Academic." action={<Can access="academic.manage"><Button asChild variant="brand"><Link href="/academic">Open Academic</Link></Button></Can>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.data.items.map((c) => {
            const rows = (assigns.data?.items ?? []).filter((a) => a.class_id === c.id);
            const ct = rows.find((a) => a.role === "class_teacher");
            const teacherCount = new Set(rows.map((a) => a.staff_id)).size;
            return (
              <Card key={c.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-[28px] font-bold leading-none tracking-tight">{classLabel(c)}</h2>
                    <p className="mt-1 text-[13px] text-muted-foreground">{c.students} of {c.capacity} seats filled</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mine.has(c.id) && <Badge tone="brand">Yours</Badge>}
                    <Can access="academic.manage"><Link href="/promotion" className="text-[13px] font-medium text-brand hover:underline" aria-label={`Promote class ${classLabel(c)}`}>Promote</Link></Can>
                  </div>
                </div>
                {ct ? <div className="flex items-center gap-3"><Avatar name={ct.staff_name} /><div><p className="text-sm font-medium">{ct.staff_name}</p><p className="text-xs text-text-tertiary">Class teacher</p></div></div>
                  : <p className="text-sm text-text-tertiary">No class teacher yet</p>}
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-muted-foreground">{assigns.isPending ? "…" : `${teacherCount} ${teacherCount === 1 ? "teacher" : "teachers"} assigned`}</p>
                  <Button variant="secondary" size="sm" onClick={() => setOpen(c)}>Students and teachers</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Roster c={open} onClose={() => setOpen(null)} />
    </>
  );
}
