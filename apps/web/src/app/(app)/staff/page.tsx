"use client";
import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { useCan } from "@/components/app/can";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/app/field";
import { CLASSES, STAFF, className, type StaffRow } from "@/lib/mock";
import { PERMISSION_LABELS, type Permission } from "@/lib/permissions";
import { formatDateOn, todayOnIST } from "@/lib/time";

type Mode = { kind: "perms" | "classes" | "absent"; id: string } | null;

export default function StaffPage() {
  const can = useCan();
  const [rows, setRows] = React.useState<StaffRow[]>(STAFF);
  const [mode, setMode] = React.useState<Mode>(null);
  if (!can("staff.manage")) return <NoAccess need="the Staff permission" />;
  const sel = rows.find((r) => r.id === mode?.id);
  const patch = (id: string, p: Partial<StaffRow>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const close = () => setMode(null);

  return (
    <>
      <PageHeader eyebrow={`${rows.length} staff`} title="Staff directory." dim="Roles, classes and attendance." />
      <Card>
        <Table className="min-w-[860px]">
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Classes</TableHead><TableHead>Permissions</TableHead><TableHead>Today</TableHead><TableHead className="text-right">Manage</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><div><p className="font-medium">{s.name}</p><p className="text-xs text-text-tertiary">{s.designation} · {s.employeeCode}</p></div></div></TableCell>
                <TableCell>{s.classes.length ? s.classes.map((c) => <span key={c.classId} className="mr-1.5 inline-block"><Badge tone={c.role === "class_teacher" ? "brand" : "neutral"}>{className(c.classId)}</Badge></span>) : <span className="text-text-tertiary">—</span>}</TableCell>
                <TableCell>{s.isAdmin ? <Badge tone="brand">Admin</Badge> : s.permissions.length ? s.permissions.map((p) => <span key={p} className="mr-1.5 inline-block"><Badge>{PERMISSION_LABELS[p]}</Badge></span>) : <span className="text-text-tertiary">—</span>}</TableCell>
                <TableCell>{s.absentToday ? <Badge tone="danger">{s.absentToday}</Badge> : <Badge tone="success">Present</Badge>}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setMode({ kind: "classes", id: s.id })}>Classes</Button>
                  <Button size="sm" variant="secondary" disabled={s.isAdmin} onClick={() => setMode({ kind: "perms", id: s.id })}>Access</Button>
                  <Button size="sm" variant="ghost" onClick={() => (s.absentToday ? (patch(s.id, { absentToday: undefined }), toast.success(`${s.name} marked present`)) : setMode({ kind: "absent", id: s.id }))}>{s.absentToday ? "Mark present" : "Mark absent"}</Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={mode?.kind === "perms"} onOpenChange={(o) => !o && close()}>
        <DialogContent>{sel && (<>
          <DialogHeader><DialogTitle>Access for {sel.name}</DialogTitle><DialogDescription>Choose what this person can manage. Admins can do everything.</DialogDescription></DialogHeader>
          <ul className="flex flex-col gap-1">
            {(Object.keys(PERMISSION_LABELS) as Permission[]).map((p) => (
              <li key={p} className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
                <Label htmlFor={p}>{PERMISSION_LABELS[p]} management</Label>
                <Switch id={p} checked={sel.permissions.includes(p)} onCheckedChange={(on) => patch(sel.id, { permissions: on ? [...sel.permissions, p] : sel.permissions.filter((x) => x !== p) })} />
              </li>
            ))}
          </ul>
          <DialogFooter><Button variant="brand" onClick={() => { toast.success("Access updated"); close(); }}>Done</Button></DialogFooter>
        </>)}</DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "classes"} onOpenChange={(o) => !o && close()}>
        <DialogContent>{sel && (<>
          <DialogHeader><DialogTitle>Classes for {sel.name}</DialogTitle><DialogDescription>Assigned teachers can message that class. Only a class teacher marks attendance and enters results.</DialogDescription></DialogHeader>
          <ul className="flex flex-col gap-1">
            {CLASSES.map((c) => {
              const a = sel.classes.find((x) => x.classId === c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-card px-4 py-3">
                  <Checkbox id={`a-${c.id}`} checked={!!a} onCheckedChange={(on) => patch(sel.id, { classes: on ? [...sel.classes, { classId: c.id, role: "subject_teacher" }] : sel.classes.filter((x) => x.classId !== c.id) })} />
                  <Label htmlFor={`a-${c.id}`} className="flex-1">Class {className(c.id)}</Label>
                  {a && <label className="flex items-center gap-2 text-xs text-muted-foreground">Class teacher
                    <Switch checked={a.role === "class_teacher"} onCheckedChange={(on) => patch(sel.id, { classes: sel.classes.map((x) => (x.classId === c.id ? { ...x, role: on ? "class_teacher" : "subject_teacher" } : x)) })} /></label>}
                </li>
              );
            })}
          </ul>
          <DialogFooter><Button variant="brand" onClick={() => { toast.success("Classes updated"); close(); }}>Done</Button></DialogFooter>
        </>)}</DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "absent"} onOpenChange={(o) => !o && close()}>
        <DialogContent>{sel && (<>
          <DialogHeader><DialogTitle>Mark {sel.name} absent</DialogTitle><DialogDescription>For {formatDateOn(todayOnIST(), "weekday")}. Their classes will show on the substitute list.</DialogDescription></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); patch(sel.id, { absentToday: String(new FormData(e.currentTarget).get("reason") || "Absent") }); toast.success(`${sel.name} marked absent`); close(); }} className="flex flex-col gap-4">
            <Field label="Reason" htmlFor="reason"><Input id="reason" name="reason" placeholder="Medical leave" /></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" variant="brand">Mark absent</Button></DialogFooter>
          </form>
        </>)}</DialogContent>
      </Dialog>
    </>
  );
}
