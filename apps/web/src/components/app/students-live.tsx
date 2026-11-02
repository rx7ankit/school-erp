"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Search, Upload, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Can } from "@/components/app/can";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { ClassSelect, DownloadButton, Problem } from "@/components/app/school-bits";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { PageHeader } from "@/components/app/page-header";
import { Pager } from "@/components/app/pager";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadStudents, useEnrolStudent, useStudentList, type StudentStatus } from "@/lib/api/hooks/students";
import { errorText } from "@/lib/api/hooks/staff";
import { formatDateOn } from "@/lib/time";

const SIZE = 25;
export const STATUS_LABEL: Record<string, string> = { active: "Active", left: "Left", tc_issued: "TC issued", passed_out: "Passed out" };
export const statusTone = (s: string) => (s === "active" ? "success" : s === "passed_out" ? "brand" : "neutral") as "success" | "brand" | "neutral";
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];

/** Students list on the real API: search, filters and paging happen on the server. */
export function StudentsLive() {
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [cls, setCls] = React.useState("");
  const [status, setStatus] = React.useState<StudentStatus>("active");
  const [page, setPage] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const filters = { q: q.trim() || undefined, class_id: cls || undefined, status };
  const list = useStudentList({ ...filters, limit: SIZE, offset: page * SIZE });
  const total = list.data?.total ?? 0;
  const rows = list.data?.items ?? [];

  return (
    <>
      <PageHeader title="Students"
        actions={<>
          <DownloadButton run={() => downloadStudents(filters)} />
          <Can access="academic.manage">
            <Button asChild variant="secondary"><Link href="/students/import"><Upload /> Import</Link></Button>
            <Button variant="brand" onClick={() => setOpen(true)}><Plus /> Add student</Button>
          </Can>
        </>} />
      <Card>
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
            <Input aria-label="Search students" className="rounded-full pl-10" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <NativeSelect aria-label="Filter by status" className="w-40" value={status} onChange={(e) => { setStatus(e.target.value as StudentStatus); setPage(0); }}>
            <option value="active">Active</option><option value="left">Left</option><option value="tc_issued">TC issued</option><option value="passed_out">Passed out</option><option value="all">All</option>
          </NativeSelect>
          <ClassSelect aria-label="Filter by class" className="w-40" all="All classes" value={cls} onChange={(v) => { setCls(v); setPage(0); }} />
        </div>
        {list.isPending ? <LoadingBlock label="Loading students" /> : list.isError ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState icon={UsersRound} title={q || cls || status !== "active" ? "No matches" : "No students yet"} action={!q && !cls && status === "active" ? <Can access="academic.manage"><Button variant="brand" onClick={() => setOpen(true)}><Plus /> Add student</Button></Can> : undefined} />
        ) : (
          <div className={list.isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}>
            <Table className="min-w-[760px]">
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Guardian</TableHead><TableHead>Born</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><div><Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link><p className="text-xs text-text-tertiary">{s.scholar_no}</p></div></div></TableCell>
                    <TableCell>{s.class_label ? <>{s.class_label}{s.roll_no ? ` · ${s.roll_no}` : ""}</> : <span className="text-text-tertiary">—</span>}</TableCell>
                    <TableCell>{s.guardian_name ? <><p>{s.guardian_name}</p><p className="text-xs text-text-tertiary">{s.guardian_phone ?? ""}</p></> : <span className="text-text-tertiary">—</span>}</TableCell>
                    <TableCell className="tabular-nums">{s.dob ? formatDateOn(s.dob) : <span className="text-text-tertiary">—</span>}</TableCell>
                    <TableCell><Badge tone={statusTone(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} pages={Math.max(1, Math.ceil(total / SIZE))} total={total} size={SIZE} setPage={setPage} />
          </div>
        )}
      </Card>
      <AddStudent open={open} onOpenChange={setOpen} />
    </>
  );
}

function AddStudent({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><AddStudentForm onOpenChange={onOpenChange} /></DialogContent></Dialog>;
}

function AddStudentForm({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const enrol = useEnrolStudent();
  const [cls, setCls] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    if (!cls) return setErr("Choose a class.");
    const send = f.get("send") === "on";
    enrol.mutate({
      first_name: String(f.get("first_name")).trim(), last_name: s("last_name") ?? "", class_id: cls, dob: s("dob"), gender: s("gender") as "male" | "female" | "other" | undefined,
      blood_group: s("blood_group"), category: s("category") as "General" | undefined, emergency_name: s("emergency_name"), emergency_phone: s("emergency_phone"),
      guardians: [{ name: String(f.get("g_name")).trim(), phone: s("g_phone"), email: s("g_email"), relation: String(f.get("g_relation")) as "father", is_primary: true, is_emergency: false }],
      create_parent_login: send, send_login: send,
    }, {
      onSuccess: (d) => { toast.success(`${d.name} added`); onOpenChange(false); },
      onError: (e) => setErr(errorText(e)),
    });
  }

  return (
    <>
        <DialogHeader><DialogTitle>Add student</DialogTitle><DialogDescription className="sr-only">Enter the student details.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="first_name"><Input id="first_name" name="first_name" required /></Field>
            <Field label="Last name" htmlFor="last_name"><Input id="last_name" name="last_name" /></Field>
            <Field label="Class" htmlFor="class"><ClassSelect id="class" value={cls} onChange={setCls} /></Field>
            <Field label="Born" htmlFor="dob"><Input id="dob" name="dob" type="date" /></Field>
            <Field label="Gender" htmlFor="gender"><NativeSelect id="gender" name="gender" defaultValue=""><option value="">None</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></NativeSelect></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guardian" htmlFor="g_name"><Input id="g_name" name="g_name" required /></Field>
            <Field label="Relation" htmlFor="g_relation"><NativeSelect id="g_relation" name="g_relation" defaultValue="father"><option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option><option value="other">Other</option></NativeSelect></Field>
            <Field label="Mobile" htmlFor="g_phone"><Input id="g_phone" name="g_phone" inputMode="tel" /></Field>
            <Field label="Email" htmlFor="g_email"><Input id="g_email" name="g_email" type="email" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Blood group" htmlFor="blood_group"><NativeSelect id="blood_group" name="blood_group" defaultValue=""><option value="">None</option>{BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}</NativeSelect></Field>
            <Field label="Category" htmlFor="category"><NativeSelect id="category" name="category" defaultValue=""><option value="">None</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
            <Field label="Emergency name" htmlFor="emergency_name"><Input id="emergency_name" name="emergency_name" /></Field>
            <Field label="Emergency mobile" htmlFor="emergency_phone"><Input id="emergency_phone" name="emergency_phone" inputMode="tel" /></Field>
          </div>
          <div className="flex items-center gap-3"><Checkbox id="send" name="send" /><Label htmlFor="send">Email parent login</Label></div>
          <Problem text={err} />
          <DialogFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="brand" loading={enrol.isPending}>Add student</Button></DialogFooter>
        </form>
    </>
  );
}
