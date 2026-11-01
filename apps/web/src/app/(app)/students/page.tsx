"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { Field } from "@/components/app/field";
import { Can } from "@/components/app/can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pager, usePaged } from "@/components/app/pager";
import { useSession } from "@/components/session-provider";
import { MissingBadge } from "@/components/app/student/missing-badge";
import { StudentPhoto } from "@/components/app/student/student-photo";
import { CLASSES, STUDENTS, className, type Student } from "@/lib/mock";
import { BLOOD_GROUPS, CATEGORIES, applyLifecycle, createRecord, getRecord, isPhone, missingDetails, useRecordsVersion } from "@/lib/student-record";
import { formatDateOn } from "@/lib/time";

function extraCells(id: string): string[] {
  const r = getRecord(id);
  return [r.bloodGroup, r.category, r.samagraId, r.pen, r.previousSchool, r.emergencyName, r.emergencyPhone, missingDetails(id).join(", ")];
}

export default function StudentsPage() {
  const { user } = useSession();
  const [rows, setRows] = React.useState<Student[]>(STUDENTS);
  const [q, setQ] = React.useState("");
  const [cls, setCls] = React.useState("all");
  const [status, setStatus] = React.useState("active");
  const [open, setOpen] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState("");
  useRecordsVersion(); // re-render when a profile changes a record

  // Teachers see their own classes by default; admin and academic managers see all.
  const seeAll = user?.isAdmin || user?.permissions.some((p) => p === "academic.manage" || p === "fees.manage" || p === "staff.manage");
  const visible = rows.map(applyLifecycle).filter((s) =>
    (seeAll || user?.classes.some((c) => c.classId === s.classId)) &&
    (cls === "all" || s.classId === cls) && (status === "all" || (status === "active" ? s.status === "active" : s.status !== "active")) &&
    `${s.name} ${s.scholarNo} ${s.guardian}`.toLowerCase().includes(q.toLowerCase()));

  const paged = usePaged(visible, 12);

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name"));
    const emergencyPhone = String(f.get("emergencyPhone") ?? "").trim(), emergencyName = String(f.get("emergencyName") ?? "").trim();
    if (emergencyPhone && !isPhone(emergencyPhone)) return setPhoneError("Mobile should be 10 digits.");
    if (emergencyPhone && !emergencyName) return setPhoneError("Add the contact's name too.");
    setPhoneError("");
    createRecord(`st${rows.length + 1}`, { bloodGroup: String(f.get("bloodGroup")), category: String(f.get("category")), emergencyName, emergencyPhone });
    setRows((r) => [{
      id: `st${r.length + 1}`, scholarNo: `RPS${2000 + r.length + 1}`, name, classId: String(f.get("class")), rollNo: r.length + 1,
      gender: "M", dob: String(f.get("dob")), guardian: String(f.get("guardian")), guardianEmail: String(f.get("email")), phone: String(f.get("phone")), address: "Rewa", status: "active",
    }, ...r]);
    setOpen(false);
    logAudit({ category: "students", action: "student.added", summary: `Added student ${name} to Class ${className(String(f.get("class")))}`, entity: name, href: "/students" });
    toast.success(`${name} added`);
  }

  return (
    <>
      <PageHeader eyebrow={`${visible.length} students`} title="Students." dim="Everyone in one list."
        actions={<><ExportButton fileName="students" build={() => [{ name: "Students", headers: ["Scholar no.", "Name", "Class", "Roll", "Gender", "Date of birth", "Guardian", "Guardian email", "Mobile", "Address", "Status", "Left on", "TC number", "Blood group", "Category", "Samagra ID", "PEN", "Previous school", "Emergency contact", "Emergency mobile", "Missing details"],
            rows: visible.map((s) => [s.scholarNo, s.name, className(s.classId), s.rollNo, s.gender === "M" ? "Male" : "Female", formatDateOn(s.dob), s.guardian, s.guardianEmail, s.phone, s.address, s.status === "active" ? "Active" : "Left school", s.leftOn ? formatDateOn(s.leftOn) : "", s.tcNumber ?? "", ...extraCells(s.id)]) }]} /><Can access="academic.manage">
          <Button asChild variant="secondary"><Link href="/students/import"><Upload /> Import Excel</Link></Button>
          <Button variant="brand" onClick={() => setOpen(true)}><Plus /> Add student</Button>
        </Can></>} />

      <Card>
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
            <Input aria-label="Search students" className="rounded-full pl-10" placeholder="Search name, scholar no, guardian" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <NativeSelect aria-label="Filter by status" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option><option value="left">Left school</option><option value="all">Everyone</option>
          </NativeSelect>
          <NativeSelect aria-label="Filter by class" className="w-40" value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="all">All classes</option>
            {CLASSES.map((c) => <option key={c.id} value={c.id}>Class {className(c.id)}</option>)}
          </NativeSelect>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Guardian</TableHead><TableHead>Date of birth</TableHead><TableHead>Status</TableHead><TableHead>Record</TableHead></TableRow></TableHeader>
          <TableBody>
            {paged.rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell><div className="flex items-center gap-3"><StudentPhoto name={s.name} url={getRecord(s.id).photoUrl} /><div><Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link><p className="text-xs text-text-tertiary">{s.scholarNo}</p></div></div></TableCell>
                <TableCell>{className(s.classId)} · {s.rollNo}</TableCell>
                <TableCell><p>{s.guardian}</p><p className="text-xs text-text-tertiary">{s.phone}</p></TableCell>
                <TableCell className="tabular-nums">{formatDateOn(s.dob)}</TableCell>
                <TableCell>{s.status === "active" ? <Badge tone="success">Active</Badge> : <Badge>Left school</Badge>}</TableCell>
                <TableCell>{s.status === "active" ? <MissingBadge missing={missingDetails(s.id)} /> : <span className="text-xs text-text-tertiary">—</span>}</TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No students match.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <Pager {...paged} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add student</DialogTitle><DialogDescription>A scholar number is created automatically.</DialogDescription></DialogHeader>
          <form onSubmit={add} className="flex flex-col gap-4">
            <Field label="Full name" htmlFor="name"><Input id="name" name="name" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Class" htmlFor="class"><NativeSelect id="class" name="class">{CLASSES.map((c) => <option key={c.id} value={c.id}>Class {className(c.id)}</option>)}</NativeSelect></Field>
              <Field label="Date of birth" htmlFor="dob"><Input id="dob" name="dob" type="date" required /></Field>
            </div>
            <Field label="Guardian name" htmlFor="guardian"><Input id="guardian" name="guardian" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Guardian mobile" htmlFor="phone"><Input id="phone" name="phone" inputMode="tel" required /></Field>
              <Field label="Guardian email" htmlFor="email" hint="Becomes the parent app login."><Input id="email" name="email" type="email" required /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Blood group" htmlFor="bloodGroup"><NativeSelect id="bloodGroup" name="bloodGroup" defaultValue=""><option value="">Not recorded</option>{BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}</NativeSelect></Field>
              <Field label="Category" htmlFor="category"><NativeSelect id="category" name="category" defaultValue=""><option value="">Not recorded</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
              <Field label="Emergency contact name" htmlFor="emergencyName"><Input id="emergencyName" name="emergencyName" /></Field>
              <Field label="Emergency contact mobile" htmlFor="emergencyPhone"><Input id="emergencyPhone" name="emergencyPhone" inputMode="tel" aria-describedby="ephone-err" aria-invalid={phoneError ? true : undefined} />
                {phoneError && <p id="ephone-err" role="alert" className="text-xs text-danger">{phoneError}</p>}</Field>
            </div>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="brand">Add student</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
