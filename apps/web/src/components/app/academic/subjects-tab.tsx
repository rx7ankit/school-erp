"use client";
import * as React from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { removeSubject, useAcademic, type Subject } from "@/lib/academic-setup";
import { usePending } from "@/lib/use-pending";
import { ConfirmDialog } from "./confirm-dialog";
import { SubjectClassGrid } from "./classes/subject-class-grid";
import { SubjectDialog } from "./classes/subject-dialog";

export function SubjectsTab() {
  const { subjects, classes, classSubjects } = useAcademic();
  const { run, is } = usePending(600);
  const [dlg, setDlg] = React.useState<Subject | "new" | null>(null);
  const [del, setDel] = React.useState<Subject | null>(null);

  const groups = React.useMemo(() => {
    const m = new Map<string, typeof classes>();
    for (const c of classes) m.set(c.grade, [...(m.get(c.grade) ?? []), c]);
    return [...m.entries()].map(([grade, sections]) => ({ title: sections[0].custom ? grade : `Class ${grade}`, sections }));
  }, [classes]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Subjects</CardTitle>
          <Button variant="brand" size="sm" onClick={() => setDlg("new")}><Plus /> Add</Button>
        </CardHeader>
        {subjects.length === 0 ? (
          <EmptyState icon={BookOpen} title="No subjects" />
        ) : (
          <ul>
            {subjects.map((s) => {
              const n = classes.filter((c) => (classSubjects[c.id] ?? []).includes(s.id)).length;
              return (
                <li key={s.id} className="flex items-center gap-4 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                  <p className="flex-1 font-medium">{s.name}</p>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{n === 0 ? "No class yet" : `${n} ${n === 1 ? "class" : "classes"}`}</span>
                  <span className="rounded-full bg-fill px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{s.code}</span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setDlg(s)}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => setDel(s)}><Trash2 /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {subjects.length > 0 && groups.length > 0 && (
        <Card>
          <CardHeader><CardTitle>By class</CardTitle></CardHeader>
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.map((g) => <SubjectClassGrid key={g.title} title={g.title} sections={g.sections} subjects={subjects} classSubjects={classSubjects} />)}
          </div>
        </Card>
      )}
      {groups.length === 0 && <EmptyState icon={BookOpen} title="No classes" />}

      <SubjectDialog target={dlg} groups={groups} onClose={() => setDlg(null)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} loading={is("del")} title="Remove subject?"
        text={`${del?.name ?? ""} is removed from every class and exam. Subjects with marks cannot be removed.`} confirmLabel="Remove"
        onConfirm={() => del && run("del", () => { const r = removeSubject(del.id); if (r.ok) toast.success("Removed"); else toast.error(r.error); setDel(null); })} />
    </div>
  );
}
