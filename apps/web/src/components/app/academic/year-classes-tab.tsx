"use client";
import * as React from "react";
import { CalendarPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addClass, addYear, activeStudentsIn, classLabel, deleteClass, setCurrentYear, updateClass, useAcademic, type ClassRow } from "@/lib/academic-setup";
import { formatDateOn } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { ConfirmDialog } from "./confirm-dialog";

export function YearClassesTab() {
  const { years, classes } = useAcademic();
  const { run, is } = usePending(600);
  const [yearDlg, setYearDlg] = React.useState(false);
  const [classDlg, setClassDlg] = React.useState<ClassRow | "new" | null>(null);
  const [del, setDel] = React.useState<ClassRow | null>(null);
  const [err, setErr] = React.useState("");
  const delCount = del ? activeStudentsIn(del.id).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div><CardTitle>Academic years</CardTitle><CardDescription>Only one year is current. Everything on the school screens follows it.</CardDescription></div>
          <Button variant="brand" size="sm" onClick={() => { setErr(""); setYearDlg(true); }}><CalendarPlus /> New year</Button>
        </CardHeader>
        <ul>
          {years.map((y) => (
            <li key={y.id} className="flex flex-wrap items-center gap-4 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
              <p className="w-24 font-bold tabular-nums">{y.label}</p>
              <p className="flex-1 text-sm tabular-nums text-muted-foreground">{formatDateOn(y.fromOn)} to {formatDateOn(y.toOn)}</p>
              <Badge tone={y.current ? "success" : "neutral"}>{y.current ? "Current" : "Draft"}</Badge>
              <Button size="sm" variant="secondary" disabled={y.current} loading={is(`y-${y.id}`)} onClick={() => run(`y-${y.id}`, () => { setCurrentYear(y.id); toast.success(`${y.label} is now the current year`); })}>Set as current</Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <div><CardTitle>Classes and sections</CardTitle><CardDescription>Capacity is the most students a section can hold.</CardDescription></div>
          <Button variant="brand" size="sm" onClick={() => { setErr(""); setClassDlg("new"); }}><Plus /> Add class</Button>
        </CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Section</TableHead><TableHead>Students</TableHead><TableHead>Capacity</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {classes.map((c) => {
              const n = activeStudentsIn(c.id).length;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">Class {c.grade}</TableCell>
                  <TableCell>{c.section}</TableCell>
                  <TableCell className="tabular-nums">{n}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{c.capacity}{n >= c.capacity && <Badge tone="warning" className="ml-2">Full</Badge>}</TableCell>
                  <TableCell><div className="flex justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit class ${classLabel(c.id)}`} onClick={() => { setErr(""); setClassDlg(c); }}><Pencil /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete class ${classLabel(c.id)}`} onClick={() => setDel(c)}><Trash2 /></Button>
                  </div></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={yearDlg} onOpenChange={setYearDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>New academic year</DialogTitle><DialogDescription>It is added as a draft. Set it as current when the year begins.</DialogDescription></DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            run("year", () => { const r = addYear(String(f.get("label")).trim(), String(f.get("from")), String(f.get("to"))); if (!r.ok) { setErr(r.error); return; } setYearDlg(false); toast.success("Academic year added as draft"); });
          }}>
            <Field label="Year" htmlFor="yl" hint="Write it as 2028-29"><Input id="yl" name="label" placeholder="2028-29" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts on" htmlFor="yf"><Input id="yf" name="from" type="date" required /></Field>
              <Field label="Ends on" htmlFor="yt"><Input id="yt" name="to" type="date" required /></Field>
            </div>
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setYearDlg(false)}>Cancel</Button><Button type="submit" variant="brand" loading={is("year")}>Add year</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={classDlg !== null} onOpenChange={(o) => !o && setClassDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{classDlg === "new" ? "Add class and section" : `Edit class ${classDlg ? classLabel(classDlg.id) : ""}`}</DialogTitle></DialogHeader>
          <form key={classDlg === "new" ? "new" : classDlg?.id} className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            const [g, s, cap] = [String(f.get("grade")).trim(), String(f.get("section")).trim(), Number(f.get("capacity"))];
            run("class", () => {
              const r = classDlg === "new" || !classDlg ? addClass(g, s, cap) : updateClass(classDlg.id, g, s, cap);
              if (!r.ok) { setErr(r.error); return; }
              toast.success(classDlg === "new" ? `Class ${g}-${s.toUpperCase()} added` : "Class updated"); setClassDlg(null);
            });
          }}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Class" htmlFor="cg"><Input id="cg" name="grade" inputMode="numeric" placeholder="6" defaultValue={classDlg && classDlg !== "new" ? classDlg.grade : ""} required /></Field>
              <Field label="Section" htmlFor="cs"><Input id="cs" name="section" maxLength={1} placeholder="A" defaultValue={classDlg && classDlg !== "new" ? classDlg.section : ""} required /></Field>
              <Field label="Capacity" htmlFor="cc"><Input id="cc" name="capacity" type="number" min={1} max={100} defaultValue={classDlg && classDlg !== "new" ? classDlg.capacity : 40} required /></Field>
            </div>
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setClassDlg(null)}>Cancel</Button><Button type="submit" variant="brand" loading={is("class")}>{classDlg === "new" ? "Add class" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} loading={is("del")}
        title={delCount ? "This class has students" : `Delete class ${del ? classLabel(del.id) : ""}?`}
        text={delCount ? `${delCount} students are in this class. Move them to another class first, then delete it.` : "The class and its subject list are removed. This cannot be undone."}
        confirmLabel={delCount ? "Cannot delete" : "Delete class"}
        onConfirm={() => { if (!del || delCount) return; run("del", () => { const r = deleteClass(del.id); if (r.ok) toast.success("Class deleted"); else toast.error(r.error); setDel(null); }); }} />
    </div>
  );
}
