"use client";
import * as React from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { ConfirmDialog } from "@/components/app/academic/confirm-dialog";
import { GuideStrip } from "@/components/app/academic/classes/guide-strip";
import { ErrorBlock, LoadingBlock, NeedsYear, classLabel, groupByGrade, noCurrentYear } from "@/components/app/academic-live-ui";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorText, useAddSubject, useClasses, useDeleteSubject, useEditSubject, useSetClassSubjects, useSubjects } from "@/lib/api/hooks/academic";
import type { ClassOut, SubjectOut } from "@/lib/api/types";

export function AcademicLiveSubjects() {
  const subjects = useSubjects();
  const classes = useClasses();
  const [dlg, setDlg] = React.useState<SubjectOut | "new" | null>(null);
  const [del, setDel] = React.useState<SubjectOut | null>(null);
  const [delErr, setDelErr] = React.useState("");
  const remove = useDeleteSubject();

  if (subjects.isPending) return <LoadingBlock label="Loading subjects" />;
  if (subjects.isError) return <ErrorBlock error={subjects.error} onRetry={() => subjects.refetch()} />;
  const subs = subjects.data.items;
  const cls = classes.data?.items ?? [];
  const groups = groupByGrade(cls);

  return (
    <div className="flex flex-col gap-4">
      <GuideStrip active={2} />
      <Card>
        <CardHeader>
          <div><CardTitle>Subjects</CardTitle><CardDescription>The code is optional and short, for example MAT. It is used on mark sheets.</CardDescription></div>
          <Button variant="brand" size="sm" onClick={() => setDlg("new")}><Plus /> Add subject</Button>
        </CardHeader>
        {subs.length === 0 ? (
          <EmptyState icon={BookOpen} title="No subjects yet" text="Add the subjects your school teaches, then choose which class studies each." />
        ) : (
          <ul>
            {subs.map((s) => {
              const n = cls.filter((c) => c.subject_ids.includes(s.id)).length;
              return (
                <li key={s.id} className="flex items-center gap-4 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                  <p className="flex-1 font-medium">{s.name}</p>
                  {classes.data && <span className="hidden text-xs text-muted-foreground sm:inline">{n === 0 ? "No class yet" : `${n} ${n === 1 ? "class" : "classes"}`}</span>}
                  {s.code && <span className="rounded-full bg-fill px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{s.code}</span>}
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setDlg(s)}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => { setDelErr(""); setDel(s); }}><Trash2 /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {noCurrentYear(classes.error) ? <NeedsYear />
        : classes.isError ? <ErrorBlock error={classes.error} onRetry={() => classes.refetch()} />
        : classes.isPending ? <LoadingBlock label="Loading classes" />
        : groups.length === 0 ? <EmptyState icon={BookOpen} title="Add classes first" text="Subjects are assigned to classes. Add sections in the Years and classes tab." />
        : subs.length > 0 && (
          <Card>
            <CardHeader><div><CardTitle>Subjects by class</CardTitle><CardDescription>Tick the subjects each class studies. Exams and teacher assignments use these.</CardDescription></div></CardHeader>
            <div className="grid gap-3 lg:grid-cols-2">
              {groups.map((g) => <MatrixGrid key={g.grade} title={g.title} sections={g.sections} subjects={subs} />)}
            </div>
          </Card>
        )}

      <SubjectDialog target={dlg} onClose={() => setDlg(null)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} loading={remove.isPending} title={`Remove ${del?.name ?? "subject"}?`}
        text={delErr || "A subject that is still taught in a class cannot be removed. Untick it in every class first."} confirmLabel="Remove subject"
        onConfirm={() => del && remove.mutate(del.id, { onSuccess: () => { toast.success("Subject removed"); setDel(null); }, onError: (e) => setDelErr(errorText(e)) })} />
    </div>
  );
}

/** Subjects x sections for one grade. Each tick saves that class's full subject list. */
function MatrixGrid({ title, sections, subjects }: { title: string; sections: ClassOut[]; subjects: SubjectOut[] }) {
  const save = useSetClassSubjects();
  const [busy, setBusy] = React.useState<string[]>([]);
  const has = (c: ClassOut, id: string) => c.subject_ids.includes(id);
  const allTicked = subjects.length > 0 && sections.every((c) => subjects.every((s) => has(c, s.id)));

  /** Set `ids` on or off for every class in `targets`, one request per class. */
  async function apply(targets: ClassOut[], ids: string[], on: boolean) {
    setBusy((b) => [...b, ...targets.map((c) => c.id)]);
    const results = await Promise.allSettled(targets.map((c) => {
      const next = on ? [...new Set([...c.subject_ids, ...ids])] : c.subject_ids.filter((x) => !ids.includes(x));
      return save.mutateAsync({ classId: c.id, subjectIds: next });
    }));
    setBusy((b) => b.filter((x) => !targets.some((c) => c.id === x)));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed) toast.error(errorText(failed.reason));
  }

  return (
    <section aria-label={title} className="rounded-2xl bg-fill/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold">{title}</h4>
        <Button size="sm" variant="secondary" disabled={busy.length > 0} onClick={() => apply(sections, subjects.map((s) => s.id), !allTicked)}>{allTicked ? `Clear all for ${title}` : `Select all for ${title}`}</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Subject</th>
              {sections.length > 1 && <th className="px-3 py-1.5 text-center font-medium">All sections</th>}
              {sections.map((c) => <th key={c.id} className="px-3 py-1.5 text-center font-medium">{classLabel(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => {
              const n = sections.filter((c) => has(c, s.id)).length;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{s.name}</td>
                  {sections.length > 1 && (
                    <td className="px-3 py-2"><div className="grid place-items-center">
                      <Checkbox aria-label={`${s.name} for every section of ${title}`} disabled={busy.length > 0} checked={n === sections.length ? true : n === 0 ? false : "indeterminate"} onCheckedChange={() => apply(sections, [s.id], n !== sections.length)} />
                    </div></td>
                  )}
                  {sections.map((c) => (
                    <td key={c.id} className="px-3 py-2"><div className="grid place-items-center">
                      <Checkbox aria-label={`${s.name} for class ${classLabel(c)}`} disabled={busy.includes(c.id)} checked={has(c, s.id)} onCheckedChange={(on) => apply([c], [s.id], on === true)} />
                    </div></td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SubjectDialog({ target, onClose }: { target: SubjectOut | "new" | null; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{target && <SubjectBody target={target} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SubjectBody({ target, onClose }: { target: SubjectOut | "new"; onClose: () => void }) {
  const add = useAddSubject();
  const edit = useEditSubject();
  const [err, setErr] = React.useState("");
  const cur = target !== "new" ? target : null;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{cur ? "Edit subject" : "Add subject"}</DialogTitle>
        {!cur && <DialogDescription>Name it, then tick the classes that study it in the grid below.</DialogDescription>}
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setErr("");
        const name = String(f.get("name")).trim(), code = String(f.get("code")).trim() || null;
        const opts = { onSuccess: () => { toast.success(cur ? "Subject updated" : "Subject added", cur ? undefined : { description: "Tick the classes that study it." }); onClose(); }, onError: (x: unknown) => setErr(errorText(x)) };
        if (cur) edit.mutate({ id: cur.id, name, code }, opts); else add.mutate({ name, code }, opts);
      }}>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="Name" htmlFor="sn"><Input id="sn" name="name" defaultValue={cur?.name ?? ""} maxLength={100} autoFocus required /></Field>
          <Field label="Code" htmlFor="sc"><Input id="sc" name="code" maxLength={20} defaultValue={cur?.code ?? ""} /></Field>
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={add.isPending || edit.isPending}>{cur ? "Save" : "Add subject"}</Button></DialogFooter>
      </form>
    </>
  );
}
