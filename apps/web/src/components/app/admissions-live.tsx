"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Search, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Pager } from "@/components/app/pager";
import { ClassSelect, DownloadButton, Problem } from "@/components/app/school-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadAdmissions, useAddAdmission, useAdmissions, useAdmissionStatus, useEnrolAdmission, type AdmissionOut, type AdmissionStatus } from "@/lib/api/hooks/admissions";
import { errorText } from "@/lib/api/hooks/staff";
import { formatIST } from "@/lib/time";

const SIZE = 25;
const TONE: Record<string, "neutral" | "brand" | "success" | "danger" | "warning"> = { enquiry: "neutral", applied: "warning", approved: "brand", rejected: "danger", enrolled: "success" };
const FILTERS = ["all", "enquiry", "applied", "approved", "enrolled", "rejected"] as const;
const GRADES = ["Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => String(i + 1))];

export function AdmissionsLive() {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [adding, setAdding] = React.useState(false);
  const [enrolling, setEnrolling] = React.useState<AdmissionOut | null>(null);
  React.useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const filters = { status: filter === "all" ? undefined : (filter as AdmissionStatus), q: q.trim() || undefined };
  const list = useAdmissions({ ...filters, limit: SIZE, offset: page * SIZE });
  const setStatus = useAdmissionStatus();
  const total = list.data?.total ?? 0;
  const rows = list.data?.items ?? [];

  const move = (a: AdmissionOut, status: "enquiry" | "applied" | "approved" | "rejected", msg: string) =>
    setStatus.mutate({ id: a.id, status }, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(errorText(e)) });
  const busy = (a: AdmissionOut, s: string) => setStatus.isPending && setStatus.variables?.id === a.id && setStatus.variables.status === s;

  return (
    <>
      <PageHeader title="Admissions"
        actions={<><DownloadButton run={() => downloadAdmissions(filters)} /><Button variant="accent" onClick={() => setAdding(true)}><Plus /> Enquiry</Button></>} />
      <Tabs value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(0); }}>
        <TabsList>{FILTERS.map((f) => <TabsTrigger key={f} value={f} className="capitalize">{f}</TabsTrigger>)}</TabsList>
      </Tabs>
      <Card>
        <div className="relative mb-5 max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input aria-label="Search admissions" className="rounded-full pl-10" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {list.isPending ? <LoadingBlock label="Loading" /> : list.isError ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState icon={UserRoundPlus} title={q || filter !== "all" ? "No matches" : "No enquiries"} action={!q && filter === "all" ? <Button variant="brand" onClick={() => setAdding(true)}><Plus /> Enquiry</Button> : undefined} />
        ) : (
          <div className={list.isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}>
            <Table className="min-w-[760px]">
              <TableHeader><TableRow><TableHead>Applicant</TableHead><TableHead>Class</TableHead><TableHead>Guardian</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.applicant_name}</TableCell>
                    <TableCell>{a.grade_applied}</TableCell>
                    <TableCell><p>{a.guardian_name}</p><p className="text-xs text-text-tertiary">{a.guardian_phone ?? a.guardian_email ?? ""}</p></TableCell>
                    <TableCell className="tabular-nums">{formatIST(a.applied_at)}</TableCell>
                    <TableCell><Badge tone={TONE[a.status] ?? "neutral"} className="capitalize">{a.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {a.status === "enquiry" && <Button size="sm" variant="secondary" loading={busy(a, "applied")} onClick={() => move(a, "applied", "Marked applied")}>Applied</Button>}
                      {a.status === "applied" && <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" loading={busy(a, "rejected")} onClick={() => move(a, "rejected", "Marked rejected")}>Reject</Button><Button size="sm" loading={busy(a, "approved")} onClick={() => move(a, "approved", "Approved")}>Approve</Button></div>}
                      {a.status === "approved" && <Button size="sm" variant="brand" onClick={() => setEnrolling(a)}>Enrol</Button>}
                      {a.status === "rejected" && <Button size="sm" variant="ghost" loading={busy(a, "applied")} onClick={() => move(a, "applied", "Reopened")}>Reopen</Button>}
                      {a.status === "enrolled" && a.student_id && <Button asChild size="sm" variant="ghost"><Link href={`/students/${a.student_id}`}>Student</Link></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} pages={Math.max(1, Math.ceil(total / SIZE))} total={total} size={SIZE} setPage={setPage} />
          </div>
        )}
      </Card>
      <NewEnquiry open={adding} onOpenChange={setAdding} />
      <EnrolDialog a={enrolling} onClose={() => setEnrolling(null)} />
    </>
  );
}

function NewEnquiry({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><NewEnquiryForm onOpenChange={onOpenChange} /></DialogContent></Dialog>;
}

function NewEnquiryForm({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const add = useAddAdmission();
  const [err, setErr] = React.useState<string | null>(null);
  const [cls, setCls] = React.useState("");
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    add.mutate({
      applicant_name: String(f.get("name")).trim(), grade_applied: String(f.get("grade")), dob: s("dob"), gender: s("gender") as "male" | undefined, class_id: cls || undefined,
      guardian_name: String(f.get("guardian")).trim(), guardian_phone: s("phone"), guardian_email: s("email"), notes: s("notes"), status: f.get("applied") === "on" ? "applied" : "enquiry",
    }, { onSuccess: () => { toast.success("Enquiry added"); onOpenChange(false); }, onError: (e2) => setErr(errorText(e2)) });
  }
  return (
    <>
        <DialogHeader><DialogTitle>New enquiry</DialogTitle><DialogDescription className="sr-only">New enquiry details.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
          <Field label="Child" htmlFor="name"><Input id="name" name="name" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Class" htmlFor="grade"><NativeSelect id="grade" name="grade">{GRADES.map((g) => <option key={g}>{g}</option>)}</NativeSelect></Field>
            <Field label="Section" htmlFor="cls"><ClassSelect id="cls" all="Later" value={cls} onChange={setCls} /></Field>
            <Field label="Born" htmlFor="dob"><Input id="dob" name="dob" type="date" /></Field>
            <Field label="Gender" htmlFor="gender"><NativeSelect id="gender" name="gender" defaultValue=""><option value="">None</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></NativeSelect></Field>
          </div>
          <Field label="Guardian" htmlFor="guardian"><Input id="guardian" name="guardian" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile" htmlFor="phone"><Input id="phone" name="phone" inputMode="tel" /></Field>
            <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" /></Field>
          </div>
          <Field label="Notes" htmlFor="notes"><Input id="notes" name="notes" /></Field>
          <div className="flex items-center gap-3"><Checkbox id="applied" name="applied" /><Label htmlFor="applied">Already applied</Label></div>
          <Problem text={err} />
          <DialogFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="brand" loading={add.isPending}>Add</Button></DialogFooter>
        </form>
    </>
  );
}

/** Enrolling is one action: the student, guardians, class, history and (optionally) the parent login are created together. */
function EnrolDialog({ a, onClose }: { a: AdmissionOut | null; onClose: () => void }) {
  return <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}><DialogContent>{a && <EnrolForm key={a.id} a={a} onClose={onClose} />}</DialogContent></Dialog>;
}

function EnrolForm({ a, onClose }: { a: AdmissionOut; onClose: () => void }) {
  const enrol = useEnrolAdmission();
  const [cls, setCls] = React.useState(a.class_id ?? "");
  const [login, setLogin] = React.useState(true);
  const [send, setSend] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  function go() {
    if (!cls) return setErr("Choose a class.");
    setErr(null);
    enrol.mutate({ id: a.id, class_id: cls, create_parent_login: login || send, send_login: send }, {
      onSuccess: (d) => { toast.success(`${d.name} enrolled`); onClose(); },
      onError: (e) => setErr(errorText(e)),
    });
  }
  return (
    <>
        <DialogHeader><DialogTitle>Enrol</DialogTitle><DialogDescription>{a.applicant_name}</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Class" htmlFor="ecls"><ClassSelect id="ecls" value={cls} onChange={setCls} /></Field>
          <div className="flex items-center gap-3"><Checkbox id="elogin" checked={login || send} disabled={send} onCheckedChange={(c) => setLogin(c === true)} /><Label htmlFor="elogin">Create parent login</Label></div>
          <div className="flex items-center gap-3"><Checkbox id="esend" checked={send} onCheckedChange={(c) => setSend(c === true)} /><Label htmlFor="esend">Email login</Label></div>
          <Problem text={err} />
        </div>
        <DialogFooter><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="brand" loading={enrol.isPending} onClick={go}>Enrol</Button></DialogFooter>
    </>
  );
}
