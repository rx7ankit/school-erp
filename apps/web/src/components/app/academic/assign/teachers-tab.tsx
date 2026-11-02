"use client";
import * as React from "react";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAcademic } from "@/lib/academic-setup";
import { classTeacherOf, classTeacherOfClasses, setClassTeacher, setSubjectTeacher, subjectTeacherOf, useAssignments } from "@/lib/assignments";
import { STAFF, className } from "@/lib/mock";
import { usePending } from "@/lib/use-pending";
import { ConfirmDialog } from "../confirm-dialog";
import { ByTeacherList } from "./by-teacher-list";
import { ClassAssignCard, type PendingChange } from "./class-assign-card";

/** The assignment matrix: class teacher and subject teachers for every class. */
export function TeachersTab() {
  const { classes, subjects, classSubjects } = useAcademic();
  useAssignments();
  const { run, is, pending } = usePending(500);
  const [confirm, setConfirm] = React.useState<PendingChange | null>(null);

  const groups = React.useMemo(() => {
    const m = new Map<string, typeof classes>();
    for (const c of classes) m.set(c.grade, [...(m.get(c.grade) ?? []), c]);
    return [...m.values()];
  }, [classes]);
  const subjectsOf = (classId: string) => subjects.filter((s) => (classSubjects[classId] ?? []).includes(s.id)).map((s) => s.name);

  function apply(c: PendingChange) {
    const key = `${c.classId}|${c.subject ?? "ct"}`;
    run(key, () => {
      const who = c.staffId ? STAFF.find((s) => s.id === c.staffId)?.name : null;
      if (c.subject) setSubjectTeacher(c.classId, c.subject, c.staffId); else setClassTeacher(c.classId, c.staffId);
      const where = `${c.subject ?? "class teacher"}, ${className(c.classId)}`;
      toast.success(who ? `${who} assigned: ${where}` : `Cleared: ${where}`);
    });
  }
  function request(c: PendingChange) {
    const prev = c.subject ? subjectTeacherOf(c.classId, c.subject) : classTeacherOf(c.classId);
    const elsewhere = !c.subject && c.staffId ? classTeacherOfClasses(c.staffId).filter((x) => x !== c.classId) : [];
    if ((prev && prev.id !== c.staffId) || elsewhere.length) setConfirm(c); else apply(c);
  }

  const prev = confirm ? (confirm.subject ? subjectTeacherOf(confirm.classId, confirm.subject) : classTeacherOf(confirm.classId)) : undefined;
  const next = confirm?.staffId ? STAFF.find((s) => s.id === confirm.staffId) : undefined;
  const label = confirm ? className(confirm.classId) : "";
  const elsewhere = confirm && !confirm.subject && confirm.staffId ? classTeacherOfClasses(confirm.staffId).filter((x) => x !== confirm.classId) : [];
  let text = "";
  if (confirm && prev && prev.id !== confirm.staffId) {
    text = confirm.subject
      ? `${prev.name} will no longer teach ${confirm.subject} in ${label}. Parents will see the old chat as inactive.`
      : `${prev.name} will no longer be class teacher of ${label}.${next ? ` ${next.name} will mark attendance and enter results for the class.` : " Nobody will be able to mark attendance for the class until you pick a new class teacher."} Parents will see the old class teacher chat as inactive.`;
  }
  if (next && elsewhere.length) text = `${text} ${next.name} is already class teacher of ${elsewhere.map(className).join(", ")} and will lead ${label} as well.`.trim();

  return (
    <div className="flex flex-col gap-4">
      {classes.length === 0 ? (
        <EmptyState icon={Layers} title="Add classes first" text="Teachers are assigned to classes and subjects. Start in the Years and classes tab." />
      ) : (
        <Tabs defaultValue="class">
          <TabsList aria-label="View"><TabsTrigger value="class">By class</TabsTrigger><TabsTrigger value="teacher">By teacher</TabsTrigger></TabsList>
          <TabsContent value="class" className="flex flex-col gap-6">
            {groups.map((g) => (
              <div key={g[0].grade} className="flex flex-col gap-3">
                <h3 className="text-[17px] font-bold">{g[0].custom ? g[0].grade : `Class ${g[0].grade}`} <span className="font-normal text-muted-foreground">{g.length} {g.length === 1 ? "section" : "sections"}</span></h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  {g.map((c) => <ClassAssignCard key={c.id} cls={c} subjects={subjectsOf(c.id)} isBusy={(k) => pending === k} onChange={request} />)}
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="teacher"><ByTeacherList /></TabsContent>
        </Tabs>
      )}
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} loading={confirm ? is(`${confirm.classId}|${confirm.subject ?? "ct"}`) : false}
        title={next ? `Change ${confirm?.subject ?? "class teacher"} for ${label}?` : `Remove the ${confirm?.subject ?? "class"} teacher of ${label}?`} text={text}
        confirmLabel={next ? "Change teacher" : "Remove teacher"}
        onConfirm={() => { if (confirm) { apply(confirm); setConfirm(null); } }} />
    </div>
  );
}
