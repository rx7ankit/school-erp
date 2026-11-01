"use client";
import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { rupees } from "@/lib/export";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_PRICE_PAISE, SCHOOLS, billable, type School } from "@/lib/platform-mock";
import { formatINR, formatIST, nowUTC } from "@/lib/time";
import { usePending } from "@/lib/use-pending";

const TONE = { active: "success", trial: "warning", suspended: "danger" } as const;

export default function OwnerSchools() {
  const [rows, setRows] = React.useState<School[]>(SCHOOLS);
  const [open, setOpen] = React.useState(false);
  const { run, is } = usePending(1000);

  function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const price = Math.round(Number(f.get("price")) * 100);
    if (!(price >= 0)) { toast.error("Enter a price per student, for example 10"); return; }
    const school: School = {
      id: crypto.randomUUID(), name: String(f.get("name")), city: String(f.get("city")), students: 0, status: "trial", pricePaise: price,
      adminName: String(f.get("admin")), adminEmail: String(f.get("email")), createdAt: nowUTC(), inviteSentAt: nowUTC(), adminLoggedIn: false,
    };
    run("create", () => {
      setRows((r) => [school, ...r]); setOpen(false);
      toast.success(`${school.name} created`, { description: `Login email sent to ${school.adminEmail}. They manage everything from there.` });
    });
  }

  return (
    <>
      <PageHeader eyebrow={`${rows.length} schools`} title="Schools." dim="Add one in a minute." actions={<><ExportButton fileName="schools" build={() => [{ name: "Schools", headers: ["School", "City", "Admin", "Admin email", "Students", "Price per student (₹)", "Monthly (₹)", "Status", "Joined (IST)"], rows: rows.map((s) => [s.name, s.city, s.adminName, s.adminEmail, s.students, rupees(s.pricePaise), rupees(billable(s)), s.status, formatIST(s.createdAt)]) }]} />
          <Button variant="brand" onClick={() => setOpen(true)}><Plus /> Add school</Button></>} />
      <Card>
        <Table className="min-w-[820px]">
          <TableHeader><TableRow><TableHead>School</TableHead><TableHead>Admin</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Monthly</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell><Link href={`/owner/schools/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link><p className="text-xs text-text-tertiary">{s.city}</p></TableCell>
                <TableCell><p>{s.adminName}</p><p className="text-xs text-text-tertiary">{s.adminEmail}</p></TableCell>
                <TableCell className="text-right tabular-nums">{s.students.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right tabular-nums">{billable(s) ? formatINR(billable(s)) : "—"}</TableCell>
                <TableCell><Badge tone={TONE[s.status]} className="capitalize">{s.status}</Badge></TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{formatIST(s.createdAt, "date")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a school</DialogTitle>
            <DialogDescription>We create the school and its admin. The admin gets a login email and sets up staff, classes and students.</DialogDescription></DialogHeader>
          <form onSubmit={create} className="flex flex-col gap-4">
            <Field label="School name" htmlFor="name"><Input id="name" name="name" required /></Field>
            <Field label="City" htmlFor="city"><Input id="city" name="city" defaultValue="Rewa" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Admin name" htmlFor="admin"><Input id="admin" name="admin" required /></Field>
              <Field label="Admin email" htmlFor="email"><Input id="email" name="email" type="email" required /></Field>
            </div>
            <Field label="Price per student per month (₹)" htmlFor="price" hint="The standard price is ₹10. New schools start on a free trial."><Input id="price" name="price" inputMode="decimal" defaultValue={DEFAULT_PRICE_PAISE / 100} required /></Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="brand" loading={is("create")}>Create and send login</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
