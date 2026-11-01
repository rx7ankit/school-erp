"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Field } from "@/components/app/field";
import { Can } from "@/components/app/can";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pager, usePaged } from "@/components/app/pager";
import { useSession } from "@/components/session-provider";
import { CLASSES, STUDENTS, className, type Student } from "@/lib/mock";
import { formatDateOn } from "@/lib/time";

export default function StudentsPage() {
  const { user } = useSession();
  const [rows, setRows] = React.useState<Student[]>(STUDENTS);
  const [q, setQ] = React.useState("");
  const [cls, setCls] = React.useState("all");
  const [status, setStatus] = React.useState("active");
  const [open, setOpen] = React.useState(false);

  // Teachers see their own classes by default; admin and academic managers see all.
  const seeAll = user?.isAdmin || user?.permissions.some((p) => p === "academic.manage" || p === "fees.manage" || p === "staff.manage");
  const visible = rows.filter((s) =>
    (seeAll || user?.classes.some((c) => c.classId === s.classId)) &&
    (cls === "all" || s.classId === cls) && (status === "all" || (status === "active" ? s.status === "active" : s.status !== "active")) &&
    `${s.name} ${s.scholarNo} ${s.guardian}`.toLowerCase().includes(q.toLowerCase()));

  const paged = usePaged(visible, 12);

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name"));
    setRows((r) => [{
      id: `st${r.length + 1}`, scholarNo: `RPS${2000 + r.length + 1}`, name, classId: String(f.get("class")), rollNo: r.length + 1,
      gender: "M", dob: String(f.get("dob")), guardian: String(f.get("guardian")), guardianEmail: String(f.get("email")), phone: String(f.get("phone")), address: "Rewa", status: "active",
    }, ...r]);
    setOpen(false);
    toast.success(`${name} added`);
  }

  return (
    <>
      <PageHeader eyebrow={`${visible.length} students`} title="Students." dim="Everyone in one list."
        actions={<Can access="academic.manage">
          <Button asChild variant="secondary"><Link href="/students/import"><Upload /> Import Excel</Link></Button>
          <Button variant="brand" onClick={() => setOpen(true)}><Plus /> Add student</Button>
        </Can>} />

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
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Guardian</TableHead><TableHead>Date of birth</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {paged.rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><div><Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link><p className="text-xs text-text-tertiary">{s.scholarNo}</p></div></div></TableCell>
                <TableCell>{className(s.classId)} · {s.rollNo}</TableCell>
                <TableCell><p>{s.guardian}</p><p className="text-xs text-text-tertiary">{s.phone}</p></TableCell>
                <TableCell className="tabular-nums">{formatDateOn(s.dob)}</TableCell>
                <TableCell>{s.status === "active" ? <Badge tone="success">Active</Badge> : <Badge>Left school</Badge>}</TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No students match.</TableCell></TableRow>}
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
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="brand">Add student</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
