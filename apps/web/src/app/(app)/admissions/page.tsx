"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { NoAccess } from "@/components/app/no-access";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/components/app/can";
import { ADMISSIONS, type AdmissionStatus } from "@/lib/mock";
import { formatIST } from "@/lib/time";
import { isLive } from "@/lib/api/config";
import { AdmissionsLive } from "@/components/app/admissions-live";

const TONE: Record<AdmissionStatus, "neutral" | "brand" | "success" | "danger" | "warning"> = { enquiry: "neutral", applied: "warning", approved: "brand", rejected: "danger", enrolled: "success" };
const FILTERS = ["all", "enquiry", "applied", "approved", "enrolled", "rejected"] as const;

function AdmissionsDemo() {
  const can = useCan();
  const [rows, setRows] = React.useState(ADMISSIONS);
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("all");
  const [open, setOpen] = React.useState(false);
  if (!can("academic.manage")) return <NoAccess need="the Academic permission" />;
  const set = (id: string, status: AdmissionStatus) => { const a = rows.find((x) => x.id === id); setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x))); logAudit({ category: "students", action: "admission.status", summary: `Marked admission of ${a?.applicant ?? "applicant"} as ${status}`, entity: a?.applicant, href: "/admissions", changes: a ? [{ field: "Status", from: a.status, to: status }] : undefined }); toast.success(`Marked ${status}`); };
  const shown = rows.filter((r) => filter === "all" || r.status === filter);

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setRows((r) => [{ id: crypto.randomUUID(), applicant: String(f.get("name")), gradeApplied: String(f.get("grade")), guardian: String(f.get("guardian")), phone: String(f.get("phone")), status: "enquiry", appliedAt: new Date().toISOString() }, ...r]);
    setOpen(false); toast.success("Enquiry added");
  }

  return (
    <>
      <PageHeader eyebrow="New session" title="Admissions." dim="From enquiry to enrolled." actions={<><ExportButton fileName="admissions" build={() => [{ name: "Admissions", headers: ["Applicant", "Class applied", "Guardian", "Mobile", "Status", "Received (IST)"], rows: rows.map((a) => [a.applicant, a.gradeApplied, a.guardian, a.phone, a.status, formatIST(a.appliedAt)]) }]} />
          <Button variant="brand" onClick={() => setOpen(true)}><Plus /> New enquiry</Button></>} />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>{FILTERS.map((f) => <TabsTrigger key={f} value={f} className="capitalize">{f}</TabsTrigger>)}</TabsList>
      </Tabs>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Applicant</TableHead><TableHead>Class</TableHead><TableHead>Guardian</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {shown.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.applicant}</TableCell>
                <TableCell>{a.gradeApplied}</TableCell>
                <TableCell><p>{a.guardian}</p><p className="text-xs text-text-tertiary">{a.phone}</p></TableCell>
                <TableCell className="tabular-nums">{formatIST(a.appliedAt)}</TableCell>
                <TableCell><Badge tone={TONE[a.status]} className="capitalize">{a.status}</Badge></TableCell>
                <TableCell className="text-right">
                  {a.status === "enquiry" && <Button size="sm" variant="secondary" onClick={() => set(a.id, "applied")}>Mark applied</Button>}
                  {a.status === "applied" && <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => set(a.id, "rejected")}>Reject</Button><Button size="sm" onClick={() => set(a.id, "approved")}>Approve</Button></div>}
                  {a.status === "approved" && <Button size="sm" variant="brand" onClick={() => set(a.id, "enrolled")}>Enrol student</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New enquiry</DialogTitle><DialogDescription>Keep it short. Details can be added at the application stage.</DialogDescription></DialogHeader>
          <form onSubmit={add} className="flex flex-col gap-4">
            <Field label="Child's name" htmlFor="name"><Input id="name" name="name" required /></Field>
            <Field label="Class applied for" htmlFor="grade"><NativeSelect id="grade" name="grade">{["Nursery","1","2","3","4","5","6","7","8","9","10","11","12"].map((g) => <option key={g}>{g}</option>)}</NativeSelect></Field>
            <Field label="Guardian name" htmlFor="guardian"><Input id="guardian" name="guardian" required /></Field>
            <Field label="Guardian mobile" htmlFor="phone"><Input id="phone" name="phone" inputMode="tel" required /></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="brand">Add enquiry</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdmissionsPage() {
  const can = useCan();
  if (!isLive) return <AdmissionsDemo />;
  return can("academic.manage") ? <AdmissionsLive /> : <NoAccess need="the Academic permission" />;
}
