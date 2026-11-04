"use client";
import * as React from "react";
import { Layers, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmDialog } from "@/components/app/academic/confirm-dialog";
import { ErrorBlock, NeedsYear, classLabel, groupByGrade, noCurrentYear } from "@/components/app/academic-live-ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Appear, Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorText, useAssignmentRows, useClasses, useSetClassTeacher, useSetSubjectTeacher, useStaffList, useSubjects } from "@/lib/api/hooks/academic";
import type { AssignmentRow, ClassOut, StaffOut, SubjectOut } from "@/lib/api/types";

interface Change { cls: ClassOut; subject: SubjectOut | null; staffId: string | null }

const hint = (s: StaffOut) => [s.designation, s.department].filter(Boolean).join(", ") || "Staff";

export function AcademicLiveTeachers() {
  const classes = useClasses();
  const subjects = useSubjects();
  const staff = useStaffList();
  const rows = useAssignmentRows();
  const setCt = useSetClassTeacher();
  const setSt = useSetSubjectTeacher();
  const [confirm, setConfirm] = React.useState<Change | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const teachers = React.useMemo(() => (staff.data?.items ?? []).filter((s) => s.is_active), [staff.data]);
  const byId = React.useMemo(() => new Map(teachers.map((s) => [s.id, s])), [teachers]);

  if (classes.isPending || subjects.isPending) return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-[38px] w-60 rounded-full" />
      <SkByClass />
    </div>
  );
  if (noCurrentYear(classes.error)) return <NeedsYear />;
  if (classes.isError) return <ErrorBlock error={classes.error} onRetry={() => classes.refetch()} />;
  if (subjects.isError) return <ErrorBlock error={subjects.error} onRetry={() => subjects.refetch()} />;

  const cls = classes.data.items;
  const subs = subjects.data.items;
  const groups = groupByGrade(cls);
  const subjectTeacher = (c: ClassOut, subjectId: string) =>
    (rows.data?.items ?? []).find((r) => r.class_id === c.id && r.role === "subject_teacher" && r.subject_id === subjectId)?.staff_id ?? "";
  const classTeachersOf = (staffId: string) => cls.filter((c) => c.class_teacher_id === staffId);
  const previous = (c: Change) => (c.subject ? subjectTeacher(c.cls, c.subject.id) : c.cls.class_teacher_id ?? "");

  function apply(c: Change) {
    const key = `${c.cls.id}|${c.subject?.id ?? "ct"}`;
    setBusy(key);
    const where = `${c.subject?.name ?? "class teacher"}, ${classLabel(c.cls)}`;
    const who = c.staffId ? byId.get(c.staffId)?.name : null;
    const opts = { onSuccess: () => toast.success(who ? `${who}: ${where}` : `Cleared: ${where}`), onError: (e: unknown) => toast.error(errorText(e)), onSettled: () => setBusy(null) };
    if (c.subject) setSt.mutate({ classId: c.cls.id, subjectId: c.subject.id, staffId: c.staffId }, opts);
    else setCt.mutate({ classId: c.cls.id, staffId: c.staffId }, opts);
  }
  function request(c: Change) {
    const prev = previous(c);
    const elsewhere = !c.subject && c.staffId ? classTeachersOf(c.staffId).filter((x) => x.id !== c.cls.id) : [];
    if ((prev && prev !== c.staffId) || elsewhere.length) setConfirm(c); else apply(c);
  }

  const next = confirm?.staffId ? byId.get(confirm.staffId) : undefined;
  const prevStaff = confirm ? byId.get(previous(confirm)) : undefined;
  const label = confirm ? classLabel(confirm.cls) : "";
  const elsewhere = confirm && !confirm.subject && confirm.staffId ? classTeachersOf(confirm.staffId).filter((x) => x.id !== confirm.cls.id) : [];
  let text = "";
  if (confirm && prevStaff && prevStaff.id !== confirm.staffId) {
    text = confirm.subject
      ? `${prevStaff.name} stops teaching ${confirm.subject.name} in ${label}.`
      : `${prevStaff.name} is no longer class teacher of ${label}.${next ? ` ${next.name} takes over.` : ""}`;
  }
  if (next && elsewhere.length) text = `${text} ${next.name} also leads ${elsewhere.map(classLabel).join(", ")}.`.trim();

  return (
    <div className="flex flex-col gap-4">
      {staff.isError && <ErrorBlock error={staff.error} onRetry={() => staff.refetch()} />}
      {cls.length === 0 ? (
        <EmptyState icon={Layers} title="No classes" />
      ) : staff.isError ? null : (
        <Tabs defaultValue="class">
          <TabsList aria-label="View"><TabsTrigger value="class">By class</TabsTrigger><TabsTrigger value="teacher">By teacher</TabsTrigger></TabsList>
          <TabsContent value="class" className="flex flex-col gap-6">
            {staff.isPending && <SkByClass />}
            {!staff.isPending && groups.map((g, gi) => (
              <Appear key={g.grade} i={Math.min(gi, 5)} className="flex flex-col gap-3">
                <h3 className="text-[17px] font-bold">{g.title}</h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  {g.sections.map((c) => {
                    const mine = subs.filter((s) => c.subject_ids.includes(s.id));
                    const missing = (c.class_teacher_id ? 0 : 1) + mine.filter((s) => !subjectTeacher(c, s.id)).length;
                    return (
                      <section key={c.id} aria-label={`Class ${classLabel(c)}`} className="flex flex-col gap-4 rounded-[20px] bg-card p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div><h4 className="text-[17px] font-bold">Class {classLabel(c)}</h4><p className="text-xs text-muted-foreground">{c.students} students</p></div>
                          {missing === 0 ? <Badge tone="success">Done</Badge> : <Badge tone="warning">{missing} open</Badge>}
                        </div>
                        <div className="grid gap-1.5">
                          <p className="text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Class teacher</p>
                          <Pick label={`Class teacher of ${classLabel(c)}`} value={c.class_teacher_id ?? ""} staff={teachers} busy={busy === `${c.id}|ct`}
                            note={(id) => { const o = classTeachersOf(id).filter((x) => x.id !== c.id); return o.length ? `, class teacher of ${o.map(classLabel).join(", ")}` : ""; }}
                            onChange={(id) => request({ cls: c, subject: null, staffId: id || null })} />
                                                  </div>
                        {mine.length === 0 ? (
                          <p className="rounded-xl bg-fill px-4 py-3 text-sm text-muted-foreground">No subjects.</p>
                        ) : (
                          <ul className="flex flex-col gap-3">
                            {mine.map((s) => (
                              <li key={s.id} className="grid items-center gap-1.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                                <span className="text-sm font-medium">{s.name}</span>
                                <Pick label={`${s.name} teacher for ${classLabel(c)}`} value={subjectTeacher(c, s.id)} staff={teachers} suggest={s.name} busy={busy === `${c.id}|${s.id}`}
                                  onChange={(id) => request({ cls: c, subject: s, staffId: id || null })} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              </Appear>
            ))}
          </TabsContent>
          <TabsContent value="teacher"><ByTeacher staff={teachers} loading={staff.isPending} classes={cls} subjects={subs} extra={rows.data?.items ?? []} /></TabsContent>
        </Tabs>
      )}
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} loading={false}
        title={next ? "Change teacher?" : "Remove teacher?"} text={text}
        confirmLabel={next ? "Change" : "Remove"}
        onConfirm={() => { if (confirm) { apply(confirm); setConfirm(null); } }} />
    </div>
  );
}

/** Loading twin of the "By class" view: a grade title over two class cards. */
function SkByClass() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
      {[0, 1].map((g) => (
        <div key={g} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((c) => (
              <section key={c} className="flex flex-col gap-4 rounded-[20px] bg-card p-5">
                <div className="flex items-center justify-between gap-2"><div><Skeleton className="h-5 w-24" /><Skeleton className="mt-1.5 h-3 w-20" /></div><Skeleton className="h-6 w-16 rounded-full" /></div>
                <div className="grid gap-1.5"><Skeleton className="h-3 w-20" /><Skeleton className="h-11 w-full rounded-xl" /></div>
                <div className="flex flex-col gap-3">{[0, 1, 2].map((r) => <div key={r} className="grid items-center gap-1.5 sm:grid-cols-[8rem_1fr] sm:gap-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-11 w-full rounded-xl" /></div>)}</div>
              </section>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Pick({ label, value, onChange, staff, busy, suggest, note }: {
  label: string; value: string; onChange: (id: string) => void; staff: StaffOut[]; busy?: boolean; suggest?: string; note?: (id: string) => string;
}) {
  const opt = (s: StaffOut) => <option key={s.id} value={s.id}>{s.name} ({hint(s)}{note?.(s.id) ?? ""})</option>;
  const sug = suggest?.toLowerCase();
  const match = sug ? staff.filter((s) => s.department.toLowerCase() === sug || s.designation.toLowerCase().startsWith(sug)) : [];
  const rest = staff.filter((s) => !match.includes(s));
  return (
    <div className="flex items-center gap-2">
      <NativeSelect aria-label={label} className="min-w-0 flex-1" value={value} disabled={busy} onChange={(e) => onChange(e.target.value)}>
        <option value="">None</option>
        {value && !staff.some((s) => s.id === value) && <option value={value}>Former staff member</option>}
        {match.length > 0 ? <><optgroup label={`${suggest} staff`}>{match.map(opt)}</optgroup><optgroup label="Other staff">{rest.map(opt)}</optgroup></> : staff.map(opt)}
      </NativeSelect>
      <span className="grid size-5 shrink-0 place-items-center text-muted-foreground" aria-live="polite">{busy && <Spinner />}</span>
    </div>
  );
}

/** The same assignments read per teacher. Staff carry their own assignments; the academic list backs them up with fresher data. */
function ByTeacher({ staff, loading, classes, subjects, extra }: { staff: StaffOut[]; loading: boolean; classes: ClassOut[]; subjects: SubjectOut[]; extra: AssignmentRow[] }) {
  const [q, setQ] = React.useState("");
  if (loading) return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-11 w-full max-w-sm rounded-xl" />
      <Card>
        <ul aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
              <div className="w-48 shrink-0"><Skeleton className="h-4 w-32" /><Skeleton className="mt-1.5 h-3 w-24" /></div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2"><Skeleton className="h-7 w-24 rounded-full" /><Skeleton className="h-7 w-28 rounded-full" /></div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
  const label = (id: string) => { const c = classes.find((x) => x.id === id); return c ? classLabel(c) : null; };
  const list = staff.filter((s) => `${s.name} ${s.designation} ${s.department}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
        <Input aria-label="Search teachers" placeholder="Search" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.length === 0 ? <EmptyState icon={Users} title="No matches" /> : (
        <Appear><Card>
          <ul>
            {list.map((s) => {
              const mine = extra.filter((a) => a.staff_id === s.id && label(a.class_id))
                .sort((a, b) => label(a.class_id)!.localeCompare(label(b.class_id)!, undefined, { numeric: true }));
              const ct = mine.filter((a) => a.role === "class_teacher");
              return (
                <li key={s.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
                  <div className="w-48 shrink-0"><p className="font-bold">{s.name}</p><p className="text-xs text-muted-foreground">{hint(s)}</p></div>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    {mine.length === 0 && <span className="text-sm text-muted-foreground">No classes</span>}
                    {mine.map((a, i) => (
                      <span key={`${a.class_id}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-sm">
                        <span className="font-medium">{label(a.class_id)}</span>
                        {a.subject_id && <span className="text-muted-foreground">{subjects.find((x) => x.id === a.subject_id)?.name}</span>}
                        {a.role === "class_teacher" && <span className="text-xs font-medium text-foreground">Class teacher</span>}
                      </span>
                    ))}
                  </div>
                  {ct.length > 1 && <Badge tone="warning">{ct.length} classes</Badge>}
                </li>
              );
            })}
          </ul>
        </Card></Appear>
      )}
    </div>
  );
}
