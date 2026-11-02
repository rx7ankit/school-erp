"use client";
import * as React from "react";
import { Download, FilePlus2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Pager } from "@/components/app/pager";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { downloadFile } from "@/lib/api/download";
import { INVOICE_PAGE, invoiceExportParams, useBillingStats, useGenerateInvoices, useInvoices, useMarkInvoicePaid, useOwnerSchools, useSetSchoolPrice, type InvoiceFilter } from "@/lib/api/hooks/owner";
import type { PlatformInvoiceOut, SchoolOut } from "@/lib/api/types";
import { formatDateOn, formatINR, formatIST, todayOnIST } from "@/lib/time";

const msg = (e: unknown) => (e instanceof ApiError ? [e.message, ...Object.values(e.fields)].join(" ") : "Something went wrong.");
export const monthLabel = (ym: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));
const monthShort = (ym: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "short" }).format(new Date(`${ym}-01T00:00:00Z`));
const MODES: [string, string][] = [["cash", "Cash"], ["upi", "UPI"], ["bank_transfer", "Bank transfer"], ["cheque", "Cheque"], ["online", "Online"]];
const MODE_LABEL = Object.fromEntries(MODES);

function Err({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 text-sm text-destructive"><span>{msg(error)}</span>{retry && <Button size="sm" variant="secondary" onClick={retry}>Retry</Button>}</div>;
}

export function InvoiceBadge({ i }: { i: Pick<PlatformInvoiceOut, "status" | "overdue"> }) {
  return i.status === "paid" ? <Badge tone="success">Paid</Badge> : i.overdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone="warning">Due</Badge>;
}

/* ---------- revenue: money cards + billed vs collected by month ---------- */
export function RevenueMoney() {
  const q = useBillingStats();
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <Err error={q.error} retry={() => q.refetch()} />;
  const s = q.data;
  const months = [...s.by_month].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  const max = Math.max(...months.flatMap((m) => [m.billed_paise, m.collected_paise]), 1);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Billed" value={formatINR(s.billed_paise)} />
        <StatCard label="Collected" value={formatINR(s.collected_paise)} />
        <StatCard label="Due" value={formatINR(s.due_paise)} />
        <StatCard label="Overdue" value={formatINR(s.overdue_paise)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>By month</CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-separator" />Billed</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" />Collected</span></div>
        </CardHeader>
        {months.length === 0 ? <p className="text-sm text-muted-foreground">No invoices.</p> : (
          <div role="img" aria-label={`Billed and collected by month, ${months.map((m) => `${monthLabel(m.month)}: billed ${formatINR(m.billed_paise)}, collected ${formatINR(m.collected_paise)}`).join("; ")}`} className="flex h-56 items-end gap-3 overflow-x-auto pb-6">
            {months.map((m) => (
              <div key={m.month} className="relative flex h-full min-w-10 flex-1 items-end justify-center gap-1">
                <div className="w-full max-w-6 rounded-t-md bg-separator" style={{ height: `${(m.billed_paise / max) * 100}%` }} title={`Billed ${formatINR(m.billed_paise)}`} />
                <div className="w-full max-w-6 rounded-t-md bg-brand" style={{ height: `${(m.collected_paise / max) * 100}%` }} title={`Collected ${formatINR(m.collected_paise)}`} />
                <span className="absolute -bottom-6 left-0 right-0 text-center text-xs text-text-tertiary">{monthShort(m.month)}</span>
              </div>
            ))}
          </div>
        )}
        {s.new_schools_by_month.length > 0 && (
          <p className="mt-4 border-t border-border pt-4 text-xs text-text-tertiary">New: {[...s.new_schools_by_month].sort((a, b) => a.month.localeCompare(b.month)).slice(-6).map((n) => `${monthShort(n.month)} ${n.count}`).join(" · ")}</p>
        )}
      </Card>
    </>
  );
}

/* ---------- mark paid ---------- */
function MarkPaidDialog({ invoice, onClose }: { invoice: PlatformInvoiceOut | null; onClose: () => void }) {
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>{invoice && <MarkPaidForm invoice={invoice} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
function MarkPaidForm({ invoice, onClose }: { invoice: PlatformInvoiceOut; onClose: () => void }) {
  const pay = useMarkInvoicePaid();
  const [mode, setMode] = React.useState("upi");
  const [ref, setRef] = React.useState("");
  const [on, setOn] = React.useState(() => todayOnIST());
  const missing = mode !== "cash" && !ref.trim();
  return (
    <>
      <DialogHeader><DialogTitle>Mark paid</DialogTitle>
        <DialogDescription>{`${invoice.school_name} · ${monthLabel(invoice.month)} · ${formatINR(invoice.amount_paise)}`}</DialogDescription></DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        pay.mutate({ id: invoice.id, body: { payment_mode: mode as never, reference: ref.trim() || null, paid_on: on || null } }, { onSuccess: () => { toast.success("Paid"); onClose(); } });
      }}>
        <Field label="Mode" htmlFor="mp-mode"><NativeSelect id="mp-mode" value={mode} onChange={(e) => setMode(e.target.value)}>{MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></Field>
        <Field label="Reference" htmlFor="mp-ref">
          <Input id="mp-ref" value={ref} maxLength={200} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label="Paid" htmlFor="mp-on"><Input id="mp-on" type="date" value={on} max={todayOnIST()} onChange={(e) => setOn(e.target.value)} /></Field>
        {pay.isError && <p role="alert" className="text-sm text-destructive">{msg(pay.error)}</p>}
        {missing && <p className="text-xs text-text-tertiary">Reference needed.</p>}
        <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={pay.isPending} disabled={missing}>Paid</Button></DialogFooter>
      </form>
    </>
  );
}

/* ---------- generate ---------- */
function GenerateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <GenerateForm onClose={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}
function GenerateForm({ onClose }: { onClose: () => void }) {
  const gen = useGenerateInvoices();
  const [month, setMonth] = React.useState("");
  const r = gen.data;
  return (
    <>
      <DialogHeader><DialogTitle>Generate</DialogTitle></DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); gen.mutate(month || undefined); }}>
        <Field label="Month" htmlFor="gen-month"><Input id="gen-month" type="month" value={month} max={todayOnIST().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} /></Field>
        {gen.isError && <p role="alert" className="text-sm text-destructive">{msg(gen.error)}</p>}
        {r && (
          <div role="status" className="rounded-2xl bg-fill p-4 text-sm">
            <p className="font-medium">{monthLabel(r.month)}: {r.created} created{r.created ? ` · ${formatINR(r.amount_paise)}` : ""}</p>
            <p className="mt-1 text-muted-foreground">Skipped {r.skipped_existing} · {r.skipped_trial} trial · {r.skipped_empty} empty</p>
          </div>
        )}
        <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>{r ? "Close" : "Cancel"}</Button><Button type="submit" variant="brand" loading={gen.isPending}><FilePlus2 /> Generate</Button></DialogFooter>
      </form>
    </>
  );
}

/* ---------- invoices table. `schoolId` fixes the school (used on a school's own page) ---------- */
export function InvoicesSection({ schoolId, title = "Invoices" }: { schoolId?: string; title?: string }) {
  const schools = useOwnerSchools();
  const [school, setSchool] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [status, setStatus] = React.useState<"" | "due" | "paid" | "overdue">("");
  const [page, setPage] = React.useState(0);
  const [pay, setPay] = React.useState<PlatformInvoiceOut | null>(null);
  const [genOpen, setGenOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const f: InvoiceFilter = { school_id: schoolId ?? (school || undefined), month: month || undefined, status: status === "overdue" ? "due" : status || undefined, overdue: status === "overdue" ? true : undefined };
  const q = useInvoices(f, page * INVOICE_PAGE);
  const set = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };

  async function exportXlsx() {
    setExporting(true);
    try { await downloadFile("/owner/billing/invoices/export", invoiceExportParams(f) as Record<string, string | undefined>, "slov-invoices.xlsx"); toast.success("Downloaded"); }
    catch (e) { toast.error(msg(e)); } finally { setExporting(false); }
  }
  const total = q.data?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={exporting} onClick={exportXlsx}>{!exporting && <Download />} Export</Button>
          {!schoolId && <Button size="sm" variant="brand" onClick={() => setGenOpen(true)}><FilePlus2 /> Generate</Button>}
        </div>
      </CardHeader>
      <div className="mb-4 flex flex-wrap gap-3">
        {!schoolId && (
          <NativeSelect aria-label="School" className="w-56" value={school} onChange={(e) => set(setSchool)(e.target.value)}>
            <option value="">All</option>{(schools.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        )}
        <Input aria-label="Month" type="month" className="w-44" value={month} onChange={(e) => set(setMonth)(e.target.value)} />
        <div className="flex gap-1">{([["", "All"], ["due", "Due"], ["overdue", "Overdue"], ["paid", "Paid"]] as const).map(([v, l]) => <Button key={v} size="sm" variant={status === v ? "default" : "secondary"} onClick={() => set(setStatus)(v)}>{l}</Button>)}</div>
      </div>
      {q.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : q.isError ? <Err error={q.error} retry={() => q.refetch()} /> : (
        <>
          <Table className="min-w-[860px]">
            <TableHeader><TableRow>{!schoolId && <TableHead>School</TableHead>}<TableHead>Month</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Due on</TableHead><TableHead>Status</TableHead><TableHead className="text-right"><span className="sr-only">Payment</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {q.data.items.length === 0 && <TableRow><TableCell colSpan={schoolId ? 7 : 8} className="text-center text-muted-foreground">{month || status || school ? "No invoices." : "No invoices."}</TableCell></TableRow>}
              {q.data.items.map((i) => (
                <TableRow key={i.id}>
                  {!schoolId && <TableCell className="font-medium">{i.school_name}</TableCell>}
                  <TableCell>{monthLabel(i.month)}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.active_students}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(i.price_per_student_paise)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatINR(i.amount_paise)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{formatDateOn(i.due_on)}</TableCell>
                  <TableCell><InvoiceBadge i={i} /></TableCell>
                  <TableCell className="text-right">
                    {i.status === "paid"
                      ? <span className="text-xs text-muted-foreground">{i.paid_at ? formatIST(i.paid_at, "date") : ""} · {MODE_LABEL[i.payment_mode ?? ""] ?? i.payment_mode}{i.reference ? ` · ${i.reference}` : ""}</span>
                      : <Button size="sm" variant="secondary" onClick={() => setPay(i)}>Paid</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager page={page} pages={Math.max(1, Math.ceil(total / INVOICE_PAGE))} total={total} size={INVOICE_PAGE} setPage={setPage} />
        </>
      )}
      <MarkPaidDialog invoice={pay} onClose={() => setPay(null)} />
      {!schoolId && <GenerateDialog open={genOpen} onOpenChange={setGenOpen} />}
    </Card>
  );
}

/* ---------- price per student, on the school page ---------- */
export function PriceCard({ school }: { school: SchoolOut }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Pencil /> Price</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>{open && <PriceForm school={school} onClose={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  );
}
function PriceForm({ school, onClose }: { school: SchoolOut; onClose: () => void }) {
  const save = useSetSchoolPrice(school.id);
  const [rupees, setRupees] = React.useState(String(school.price_per_student_paise / 100));
  const paise = Math.round(Number(rupees) * 100);
  const valid = rupees.trim() !== "" && Number.isFinite(paise) && paise >= 0 && paise <= 100_000;
  const fields = save.error instanceof ApiError ? save.error.fields : {};
  return (
    <>
      <DialogHeader><DialogTitle>Price per student</DialogTitle><DialogDescription>{school.name}</DialogDescription></DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(paise, { onSuccess: () => { toast.success("Saved"); onClose(); } }); }}>
        <Field label="₹ per student" htmlFor="price">
          <Input id="price" inputMode="decimal" type="number" min={0} max={1000} step="0.01" value={rupees} onChange={(e) => setRupees(e.target.value)} />
          {fields.price_per_student_paise && <p className="text-xs text-destructive">{fields.price_per_student_paise}</p>}
        </Field>
        {valid && <p className="text-sm text-muted-foreground">{formatINR(paise * school.active_students)} / month</p>}
        {save.isError && !Object.keys(fields).length && <p role="alert" className="text-sm text-destructive">{msg(save.error)}</p>}
        <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={save.isPending} disabled={!valid}>Save</Button></DialogFooter>
      </form>
    </>
  );
}
