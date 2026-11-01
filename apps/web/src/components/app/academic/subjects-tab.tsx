"use client";
import * as React from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addSubject, classLabel, removeSubject, setClassSubject, updateSubject, useAcademic, type Subject } from "@/lib/academic-setup";
import { usePending } from "@/lib/use-pending";
import { ConfirmDialog } from "./confirm-dialog";

export function SubjectsTab() {
  const { subjects, classes, classSubjects } = useAcademic();
  const { run, is } = usePending(600);
  const [dlg, setDlg] = React.useState<Subject | "new" | null>(null);
  const [del, setDel] = React.useState<Subject | null>(null);
  const [err, setErr] = React.useState("");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div><CardTitle>Subjects</CardTitle><CardDescription>The code is short, for example MAT. It is used on mark sheets.</CardDescription></div>
          <Button variant="brand" size="sm" onClick={() => { setErr(""); setDlg("new"); }}><Plus /> Add subject</Button>
        </CardHeader>
        {subjects.length === 0 ? (
          <EmptyState icon={BookOpen} title="No subjects yet" text="Add the subjects your school teaches, then choose which class studies each." />
        ) : (
          <ul>
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center gap-4 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                <p className="flex-1 font-medium">{s.name}</p>
                <span className="rounded-full bg-fill px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{s.code}</span>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => { setErr(""); setDlg(s); }}><Pencil /></Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => setDel(s)}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {subjects.length > 0 && classes.length > 0 && (
        <Card>
          <CardHeader><div><CardTitle>Subjects by class</CardTitle><CardDescription>Tick the subjects each class studies. Exams can only use these.</CardDescription></div></CardHeader>
          <Table className="min-w-[520px]">
            <TableHeader><TableRow><TableHead>Subject</TableHead>{classes.map((c) => <TableHead key={c.id} className="text-center">{classLabel(c.id)}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  {classes.map((c) => (
                    <TableCell key={c.id}><div className="grid place-items-center">
                      <Checkbox aria-label={`${s.name} for class ${classLabel(c.id)}`} checked={(classSubjects[c.id] ?? []).includes(s.id)} onCheckedChange={(on) => setClassSubject(c.id, s.id, on === true)} />
                    </div></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dlg !== null} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dlg === "new" ? "Add subject" : "Edit subject"}</DialogTitle></DialogHeader>
          <form key={dlg === "new" ? "new" : dlg?.id} className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            const [name, code] = [String(f.get("name")), String(f.get("code"))];
            run("subject", () => {
              const r = dlg === "new" || !dlg ? addSubject(name, code) : updateSubject(dlg.id, name, code);
              if (!r.ok) { setErr(r.error); return; }
              toast.success(dlg === "new" ? "Subject added" : "Subject updated"); setDlg(null);
            });
          }}>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Name" htmlFor="sn"><Input id="sn" name="name" defaultValue={dlg && dlg !== "new" ? dlg.name : ""} required /></Field>
              <Field label="Code" htmlFor="sc"><Input id="sc" name="code" maxLength={5} defaultValue={dlg && dlg !== "new" ? dlg.code : ""} required /></Field>
            </div>
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button type="submit" variant="brand" loading={is("subject")}>{dlg === "new" ? "Add subject" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} loading={is("del")} title={`Remove ${del?.name ?? "subject"}?`}
        text="It is taken off every class and every exam. A subject that already has marks cannot be removed." confirmLabel="Remove subject"
        onConfirm={() => del && run("del", () => { const r = removeSubject(del.id); if (r.ok) toast.success("Subject removed"); else toast.error(r.error); setDel(null); })} />
    </div>
  );
}
