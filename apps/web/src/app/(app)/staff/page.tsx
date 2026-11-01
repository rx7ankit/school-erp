"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import { KeyRound, MoreHorizontal, Pencil, Plus, Send, UserMinus, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { ExportButton } from "@/components/app/export-button";
import { useCan } from "@/components/app/can";
import { Field } from "@/components/app/field";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CLASSES, STAFF, className, type StaffRow } from "@/lib/mock";
import { PERMISSION_LABELS, type Permission } from "@/lib/permissions";
import { formatDateOn, formatIST, nowUTC, todayOnIST } from "@/lib/time";
import { usePending } from "@/lib/use-pending";

type Mode = { kind: "perms" | "classes" | "absent" | "edit"; id: string } | null;
const INVITE = { not_sent: ["Not sent", "neutral"], sent: ["Email sent", "warning"], active: ["Logged in", "success"] } as const;

export default function StaffPage() {
  const can = useCan();
  const [rows, setRows] = React.useState<StaffRow[]>(STAFF);
  const [mode, setMode] = React.useState<Mode>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [list, setList] = React.useState("");
  const { run, is } = usePending(900);
  if (!can("staff.manage")) return <NoAccess need="the Staff permission" />;
  const sel = rows.find((r) => r.id === mode?.id);
  /** One place for every staff change, so access, class and attendance changes are always audit logged. */
  const patch = (id: string, p: Partial<StaffRow>) => {
    const old = rows.find((x) => x.id === id);
    if (old) {
      if (p.permissions) {
        const names = (list: Permission[]) => list.map((k) => PERMISSION_LABELS[k]).join(", ") || "None";
        logAudit({ category: "staff", action: "staff.access_changed", summary: `Changed access for ${old.name}: ${names(old.permissions)} to ${names(p.permissions)}`, entity: old.name, href: "/staff", sensitive: true, changes: [{ field: "Access", from: names(old.permissions), to: names(p.permissions) }] });
      }
      if (p.classes) {
        const desc = (cl: StaffRow["classes"]) => cl.map((c) => `${className(c.classId)}${c.role === "class_teacher" ? " (class teacher)" : ""}`).join(", ") || "None";
        const roleChange = p.classes.some((c) => c.role === "class_teacher" && !old.classes.some((o) => o.classId === c.classId && o.role === "class_teacher")) || old.classes.some((o) => o.role === "class_teacher" && !p.classes!.some((c) => c.classId === o.classId && c.role === "class_teacher"));
        logAudit({ category: "staff", action: roleChange ? "classteacher.changed" : "staff.classes_changed", summary: `Changed classes for ${old.name}: ${desc(old.classes)} to ${desc(p.classes)}`, entity: old.name, href: "/staff", sensitive: roleChange, changes: [{ field: "Classes", from: desc(old.classes), to: desc(p.classes) }] });
      }
      if ("absentToday" in p) logAudit({ category: "staff", action: p.absentToday ? "staff.absent" : "staff.present", summary: p.absentToday ? `Marked ${old.name} absent today. Reason: ${p.absentToday}` : `Marked ${old.name} present again`, entity: old.name, href: "/staff" });
    }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));
  };
  const close = () => setMode(null);
  const status = (s: StaffRow) => s.invite ?? "not_sent";
  const pending = rows.filter((r) => status(r) === "not_sent");

  const sendLogin = (ids: string[], key: string) => run(key, () => {
    const at = nowUTC();
    setRows((r) => r.map((x) => (ids.includes(x.id) ? { ...x, invite: x.invite === "active" ? "active" : "sent", inviteSentAt: at } : x)));
    logAudit({ category: "staff", action: "login.sent", summary: ids.length === 1 ? `Sent login email to ${rows.find((x) => x.id === ids[0])?.name ?? "staff member"}` : `Sent login emails to ${ids.length} staff`, entity: ids.length === 1 ? rows.find((x) => x.id === ids[0])?.name : "Staff", href: "/staff" });
    toast.success(ids.length === 1 ? "Login email sent" : `Login emails sent to ${ids.length} staff`, { description: "A fresh temporary password was created for each." });
  });

  function addOne(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = rows.length + 1;
    const row: StaffRow = { id: crypto.randomUUID(), name: String(f.get("name")), designation: String(f.get("designation")), department: String(f.get("department")), phone: String(f.get("phone")), email: String(f.get("email")).toLowerCase(),
      isAdmin: false, permissions: [], classes: [], employeeCode: `EMP${String(n).padStart(3, "0")}`, joinedOn: todayOnIST(), invite: "not_sent" };
    run("add", () => {
      const send = f.get("send") === "on";
      setRows((r) => [...r, send ? { ...row, invite: "sent", inviteSentAt: nowUTC() } : row]); setAddOpen(false);
      logAudit({ category: "staff", action: "staff.added", summary: `Added staff member ${row.name} (${row.designation})`, entity: row.name, href: "/staff" });
      toast.success(`${row.name} added`, { description: send ? `Login email sent to ${row.email}` : "Send the login email when ready." });
    });
  }

  // "name, designation, email" per line
  const parsed = list.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, designation, email] = l.split(/[,\t]/).map((x) => x.trim());
    return { name, designation, email, ok: !!name && !!designation && /^\S+@\S+\.\S+$/.test(email ?? "") };
  });
  const valid = parsed.filter((p) => p.ok);
  function addList() {
    run("list", () => {
      setRows((r) => [...r, ...valid.map((p, i) => ({ id: crypto.randomUUID(), name: p.name, designation: p.designation, department: "—", phone: "", email: p.email.toLowerCase(), isAdmin: false, permissions: [] as Permission[], classes: [], employeeCode: `EMP${String(r.length + i + 1).padStart(3, "0")}`, joinedOn: todayOnIST(), invite: "not_sent" as const }))]);
      logAudit({ category: "staff", action: "staff.added", summary: `Added ${valid.length} staff members from a list`, entity: "Staff list", href: "/staff" });
      setListOpen(false); setList(""); toast.success(`${valid.length} staff added`);
    });
  }

  return (
    <>
      <PageHeader eyebrow={`${rows.length} staff`} title="Staff." dim="Add people, give access, assign classes."
        actions={<>
          <ExportButton fileName="staff" build={() => [{ name: "Staff", headers: ["Code", "Name", "Designation", "Department", "Email", "Phone", "Joined", "Access", "Classes", "Today", "Login"],
            rows: rows.map((s) => [s.employeeCode, s.name, s.designation, s.department, s.email ?? "", s.phone, formatDateOn(s.joinedOn), s.isAdmin ? "Admin" : s.permissions.map((p) => PERMISSION_LABELS[p]).join(", "), s.classes.map((c) => `${className(c.classId)}${c.role === "class_teacher" ? " (class teacher)" : ""}`).join(", "), s.absentToday ?? "Present", INVITE[status(s)][0]]) }]} />
          <Button variant="secondary" onClick={() => setListOpen(true)}><UsersRound /> Add list</Button>
          <Button variant="brand" onClick={() => setAddOpen(true)}><Plus /> Add staff</Button>
        </>} />
      {pending.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm"><b>{pending.length}</b> {pending.length === 1 ? "person has" : "people have"} not received a login yet.</p>
          <Button variant="brand" size="sm" loading={is("all")} onClick={() => sendLogin(pending.map((p) => p.id), "all")}><Send /> Send login to all</Button>
        </Card>
      )}
      <Card>
        <Table className="min-w-[900px]">
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Classes</TableHead><TableHead>Access</TableHead><TableHead>Login</TableHead><TableHead>Today</TableHead><TableHead className="text-right"> </TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><div><p className="font-medium">{s.name}</p><p className="text-xs text-text-tertiary">{s.designation} · {s.email}</p></div></div></TableCell>
                <TableCell>{s.classes.length ? s.classes.map((c) => <span key={c.classId} className="mr-1.5 inline-block"><Badge tone={c.role === "class_teacher" ? "brand" : "neutral"}>{className(c.classId)}</Badge></span>) : <span className="text-text-tertiary">—</span>}</TableCell>
                <TableCell>{s.isAdmin ? <Badge tone="brand">Admin</Badge> : s.permissions.length ? s.permissions.map((p) => <span key={p} className="mr-1.5 inline-block"><Badge>{PERMISSION_LABELS[p]}</Badge></span>) : <span className="text-text-tertiary">—</span>}</TableCell>
                <TableCell><Badge tone={INVITE[status(s)][1]}>{INVITE[status(s)][0]}</Badge>{s.inviteSentAt && <p className="mt-1 text-xs tabular-nums text-text-tertiary">{formatIST(s.inviteSentAt, "short")}</p>}</TableCell>
                <TableCell>{s.absentToday ? <Badge tone="danger">{s.absentToday}</Badge> : <Badge tone="success">Present</Badge>}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {status(s) === "not_sent" && <Button size="sm" variant="brand" loading={is(s.id)} onClick={() => sendLogin([s.id], s.id)}>Send login</Button>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon-sm" variant="secondary" aria-label={`Manage ${s.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setMode({ kind: "edit", id: s.id })}><Pencil /> Edit details</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setMode({ kind: "classes", id: s.id })}><UsersRound /> Classes and class teacher</DropdownMenuItem>
                        {!s.isAdmin && <DropdownMenuItem onSelect={() => setMode({ kind: "perms", id: s.id })}><KeyRound /> Access</DropdownMenuItem>}
                        {status(s) !== "not_sent" && <DropdownMenuItem onSelect={() => sendLogin([s.id], s.id)}><Send /> Resend login email</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        {s.absentToday
                          ? <DropdownMenuItem onSelect={() => { patch(s.id, { absentToday: undefined }); const m = STAFF.find((x) => x.id === s.id); if (m) m.absentToday = undefined; toast.success(`${s.name} marked present`); }}><UserPlus /> Mark present</DropdownMenuItem>
                          : <DropdownMenuItem onSelect={() => setMode({ kind: "absent", id: s.id })}><UserMinus /> Mark absent today</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add staff</DialogTitle><DialogDescription>They sign in with this email. Give access and classes after adding.</DialogDescription></DialogHeader>
          <form onSubmit={addOne} className="flex flex-col gap-4">
            <Field label="Full name" htmlFor="name"><Input id="name" name="name" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Designation" htmlFor="designation"><Input id="designation" name="designation" placeholder="Maths teacher" required /></Field>
              <Field label="Department" htmlFor="department"><Input id="department" name="department" placeholder="Mathematics" /></Field>
              <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required /></Field>
              <Field label="Mobile" htmlFor="phone"><Input id="phone" name="phone" inputMode="tel" /></Field>
            </div>
            <div className="flex items-center gap-3"><Checkbox id="send" name="send" defaultChecked /><Label htmlFor="send">Send the login email now</Label></div>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" variant="brand" loading={is("add")}>Add staff</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a list of staff</DialogTitle><DialogDescription>One line per person: name, designation, email. Logins are created, then you send them in one click.</DialogDescription></DialogHeader>
          <Field label="Staff list" htmlFor="slist"><Textarea id="slist" value={list} onChange={(e) => setList(e.target.value)} className="font-mono text-[13px]" placeholder={"Asha Verma, Maths teacher, asha@school.in\nRahul Soni, Peon, rahul@school.in"} /></Field>
          {parsed.length > 0 && <p className="text-sm text-muted-foreground">{valid.length} of {parsed.length} lines ready.{parsed.some((p) => !p.ok) && <span className="text-danger"> Check lines missing a name, designation or a valid email.</span>}</p>}
          <DialogFooter><Button variant="secondary" onClick={() => setListOpen(false)}>Cancel</Button><Button variant="brand" disabled={!valid.length} loading={is("list")} onClick={addList}>Add {valid.length || ""} staff</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "edit"} onOpenChange={(o) => !o && close()}>
        <DialogContent>{sel && (<>
          <DialogHeader><DialogTitle>Edit {sel.name}</DialogTitle></DialogHeader>
          <form key={sel.id} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run("edit", () => { patch(sel.id, { name: String(f.get("name")), designation: String(f.get("designation")), department: String(f.get("department")), phone: String(f.get("phone")), email: String(f.get("email")) }); toast.success("Details saved"); close(); }); }} className="flex flex-col gap-4">
            <Field label="Full name" htmlFor="en"><Input id="en" name="name" defaultValue={sel.name} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Designation" htmlFor="ed"><Input id="ed" name="designation" defaultValue={sel.designation} required /></Field>
              <Field label="Department" htmlFor="ep"><Input id="ep" name="department" defaultValue={sel.department} /></Field>
              <Field label="Email" htmlFor="ee"><Input id="ee" name="email" type="email" defaultValue={sel.email} required /></Field>
              <Field label="Mobile" htmlFor="eph"><Input id="eph" name="phone" defaultValue={sel.phone} /></Field>
            </div>
            <DialogFooter><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" variant="brand" loading={is("edit")}>Save</Button></DialogFooter>
          </form>
        </>)}</DialogContent>
      </Dialog>

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
                  <Checkbox id={`a-${c.id}`} checked={!!a} onCheckedChange={(on) => patch(sel.id, { classes: on ? [...sel.classes, { classId: c.id, role: "subject_teacher", subject: sel.department }] : sel.classes.filter((x) => x.classId !== c.id) })} />
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
          <form onSubmit={(e) => { e.preventDefault(); const reason = String(new FormData(e.currentTarget).get("reason") || "Absent"); patch(sel.id, { absentToday: reason });
            // Keep the shared staff list in step, so the timetable can see who needs cover.
            const m = STAFF.find((x) => x.id === sel.id); if (m) m.absentToday = reason;
            toast.success(`${sel.name} marked absent`, sel.classes.length ? { description: "Their periods today need a substitute.", action: <Link href="/timetable?tab=substitutes" className="font-medium text-brand">Plan cover</Link> } : undefined); close(); }} className="flex flex-col gap-4">
            <Field label="Reason" htmlFor="reason"><Input id="reason" name="reason" placeholder="Medical leave" /></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" variant="brand">Mark absent</Button></DialogFooter>
          </form>
        </>)}</DialogContent>
      </Dialog>
    </>
  );
}
