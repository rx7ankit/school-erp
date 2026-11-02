"use client";
import * as React from "react";
import Link from "next/link";
import { Ban, Bell, Eye, Receipt as ReceiptIcon, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Pager } from "@/components/app/pager";
import { Problem, ExcelButton, useDebounced, monthStartOf } from "@/components/app/bits-a3";
import { CancelPaymentDialog, LiveInvoiceDialog, LiveReceiptDialog, LiveRecordPaymentDialog, STATUS_TONE } from "@/components/app/fees-live-dialogs";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClasses } from "@/lib/api/hooks/academic";
import { MODE_NAME, useCollection, useDues, useInvoices, usePayments, useReminders, useSendReminders, type InvoiceRow, type Receipt } from "@/lib/api/hooks/fees";
import { inr } from "@/lib/money";
import { formatDateOn, formatIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";
import { Wallet } from "lucide-react";

const SIZE = 20;

/** Fees on the real API: dues overview, invoices, payments and receipts, reminders, collection report. */
export function FeesLive() {
  const dues = useDues({ limit: 1, offset: 0 });
  const [pay, setPay] = React.useState<{ id: string; invoice_no: string; student_name: string; balance_paise: number } | null>(null);
  const [view, setView] = React.useState<string | null>(null);
  const [receiptId, setReceiptId] = React.useState<string | null>(null);
  const [fresh, setFresh] = React.useState<Receipt | null>(null);
  const [cancelP, setCancelP] = React.useState<{ id: string; receipt_no: string; amount_paise: number } | null>(null);
  const money = dues.data;

  return (
    <>
      <PageHeader eyebrow="Fees" title="Fees." dim="Record what you collect."
        actions={<Button variant="secondary" asChild><Link href="/fees/setup"><Settings2 /> Setup</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total dues" value={money ? inr(money.total_due_paise) : "—"} hint={money ? `${money.students} ${money.students === 1 ? "student owes" : "students owe"} fees` : undefined} />
        <StatCard label="Overdue" value={money ? inr(money.total_overdue_paise) : "—"} hint="Past the due date" />
        <StatCard label="Defaulters" value={money ? money.students : "—"} hint="Includes students who left" />
      </div>
      {dues.isError && <Problem error={dues.error} />}
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="dues">Dues</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger><TabsTrigger value="report">Collection report</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices"><InvoicesTab onView={setView} onPay={setPay} /></TabsContent>
        <TabsContent value="payments"><PaymentsTab onReceipt={setReceiptId} onCancel={setCancelP} /></TabsContent>
        <TabsContent value="dues"><DuesTab /></TabsContent>
        <TabsContent value="reminders"><RemindersTab /></TabsContent>
        <TabsContent value="report"><ReportTab /></TabsContent>
      </Tabs>
      <LiveInvoiceDialog invoiceId={view} onClose={() => setView(null)} onRecord={(i) => { setView(null); setPay(i); }} onReceipt={setReceiptId} />
      <LiveRecordPaymentDialog invoice={pay} onClose={() => setPay(null)} onSaved={setFresh} />
      <LiveReceiptDialog paymentId={receiptId} receipt={fresh} onClose={() => { setReceiptId(null); setFresh(null); }} />
      <CancelPaymentDialog payment={cancelP} onClose={() => setCancelP(null)} />
    </>
  );
}

function Search_({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
      <Input aria-label={label} className="rounded-full pl-10" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const Head = ({ cols }: { cols: (string | [string, string])[] }) => (
  <TableHeader><TableRow>{cols.map((c) => typeof c === "string" ? <TableHead key={c}>{c}</TableHead> : <TableHead key={c[0]} className={c[1]}>{c[0]}</TableHead>)}</TableRow></TableHeader>
);
const Empty = ({ cols, text }: { cols: number; text: string }) => <TableRow><TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">{text}</TableCell></TableRow>;

function InvoicesTab({ onView, onPay }: { onView: (id: string) => void; onPay: (i: InvoiceRow) => void }) {
  const [status, setStatus] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [page, setPage] = React.useState(0);
  const q = useDebounced(search);
  React.useEffect(() => setPage(0), [q, status, classId]);
  const classes = useClasses();
  const list = useInvoices({ status: status === "all" ? undefined : status, q: q.trim() || undefined, class_id: classId || undefined, limit: SIZE, offset: page * SIZE });
  const total = list.data?.total ?? 0;
  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>{["all", "unpaid", "partial", "paid", "closed"].map((f) => <TabsTrigger key={f} value={f} className="capitalize">{f}</TabsTrigger>)}</TabsList>
        </Tabs>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <NativeSelect aria-label="Class" className="w-40" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All classes</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>Class {c.grade}-{c.section}</option>)}
          </NativeSelect>
          <Search_ value={search} onChange={setSearch} label="Search invoices" placeholder="Student, scholar no. or invoice" />
        </div>
      </div>
      {list.isError ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : (
        <>
          <Table className={list.isPlaceholderData ? "min-w-[820px] opacity-60" : "min-w-[820px]"}>
            <Head cols={["Invoice", "Student", ["Amount", "text-right"], ["Paid", "text-right"], ["Balance", "text-right"], "Status", ["Action", "text-right"]]} />
            <TableBody>
              {list.isPending && <Empty cols={7} text="Loading invoices…" />}
              {list.data?.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{i.invoice_no}<p className="text-xs text-text-tertiary">{i.period_label}</p></TableCell>
                  <TableCell><p className="font-medium">{i.student_name}</p><p className="text-xs text-text-tertiary">{i.class_label ? `Class ${i.class_label} · ` : ""}{i.scholar_no}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{inr(i.total_paise)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(i.paid_paise)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(i.balance_paise)}<p className="text-xs text-text-tertiary">due {formatDateOn(i.due_on, "short")}</p></TableCell>
                  <TableCell><div className="flex flex-col items-start gap-1"><Badge tone={STATUS_TONE[i.status as keyof typeof STATUS_TONE] ?? "neutral"} className="capitalize">{i.status}</Badge>{i.overdue && i.balance_paise > 0 && <Badge tone="danger">Overdue</Badge>}</div></TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => onView(i.id)}><Eye /> View</Button>
                    {i.balance_paise > 0 && i.status !== "closed" && <Button size="sm" variant="brand" onClick={() => onPay(i)}>Record payment</Button>}
                  </div></TableCell>
                </TableRow>
              ))}
              {list.isSuccess && total === 0 && <Empty cols={7} text={q || status !== "all" || classId ? "No invoices match." : "No invoices yet. Generate them in Setup, Generate invoices."} />}
            </TableBody>
          </Table>
          <Pager page={page} pages={Math.max(1, Math.ceil(total / SIZE))} total={total} size={SIZE} setPage={setPage} />
        </>
      )}
    </Card>
  );
}

function PaymentsTab({ onReceipt, onCancel }: { onReceipt: (id: string) => void; onCancel: (p: { id: string; receipt_no: string; amount_paise: number }) => void }) {
  const [search, setSearch] = React.useState("");
  const [mode, setMode] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(0);
  const q = useDebounced(search);
  React.useEffect(() => setPage(0), [q, mode, status, from, to]);
  const list = usePayments({ q: q.trim() || undefined, mode: mode || undefined, status: status || undefined, date_from: from || undefined, date_to: to || undefined, limit: SIZE, offset: page * SIZE });
  const total = list.data?.total ?? 0;
  return (
    <Card className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Search_ value={search} onChange={setSearch} label="Search payments" placeholder="Receipt or reference" />
        <NativeSelect aria-label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value)}><option value="">All modes</option>{Object.entries(MODE_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
        <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Active and cancelled</option><option value="active">Active</option><option value="cancelled">Cancelled</option></NativeSelect>
        <Input aria-label="From date (IST)" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <Input aria-label="To date (IST)" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>
      {list.isError ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : (
        <>
          <Table className={list.isPlaceholderData ? "min-w-[860px] opacity-60" : "min-w-[860px]"}>
            <Head cols={["Receipt", "Student", ["Amount", "text-right"], "Paid by", "Received", "Status", ["Action", "text-right"]]} />
            <TableBody>
              {list.isPending && <Empty cols={7} text="Loading payments…" />}
              {list.data?.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums">{p.receipt_no}<p className="text-xs text-text-tertiary">{p.invoice_no}</p></TableCell>
                  <TableCell className="font-medium">{p.student_name}</TableCell>
                  <TableCell className={`text-right tabular-nums ${p.status !== "active" ? "text-text-tertiary line-through" : ""}`}>{inr(p.amount_paise)}</TableCell>
                  <TableCell>{MODE_NAME[p.mode] ?? p.mode}{p.reference && <p className="text-xs text-text-tertiary">{p.reference}</p>}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{formatIST(p.received_at)}{p.received_by_name && <p className="text-xs text-text-tertiary">{p.received_by_name}</p>}</TableCell>
                  <TableCell>{p.status === "active" ? <Badge tone="success">Active</Badge> : <div><Badge tone="danger">Cancelled</Badge>{p.cancel_reason && <p className="mt-1 max-w-48 text-xs text-text-tertiary">{p.cancel_reason}</p>}</div>}</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => onReceipt(p.id)}><ReceiptIcon /> Receipt</Button>
                    {p.status === "active" && <Button size="sm" variant="ghost" onClick={() => onCancel(p)}><Ban /> Cancel</Button>}
                  </div></TableCell>
                </TableRow>
              ))}
              {list.isSuccess && total === 0 && <Empty cols={7} text="No payments match." />}
            </TableBody>
          </Table>
          <Pager page={page} pages={Math.max(1, Math.ceil(total / SIZE))} total={total} size={SIZE} setPage={setPage} />
        </>
      )}
    </Card>
  );
}

function DuesTab() {
  const [overdue, setOverdue] = React.useState(false);
  const [classId, setClassId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const q = useDebounced(search);
  React.useEffect(() => setPage(0), [q, overdue, classId]);
  const classes = useClasses();
  const f = { overdue_only: overdue || undefined, class_id: classId || undefined, q: q.trim() || undefined };
  const list = useDues({ ...f, limit: SIZE, offset: page * SIZE });
  const total = list.data?.total ?? 0;
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0"><div><CardTitle>Who owes what</CardTitle><CardDescription>Open invoices plus opening balances, as on {list.data ? formatDateOn(list.data.as_of) : "today"}.</CardDescription></div>
        <ExcelButton path="/fees/reports/dues/export" params={f} fallbackName="fee-dues.xlsx" /></CardHeader>
      <div className="flex flex-wrap items-center gap-3">
        <Search_ value={search} onChange={setSearch} label="Search dues" placeholder="Student or scholar no." />
        <NativeSelect aria-label="Class" className="w-40" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">All classes</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>Class {c.grade}-{c.section}</option>)}</NativeSelect>
        <div className="flex items-center gap-2"><Checkbox id="od" checked={overdue} onCheckedChange={(v) => setOverdue(v === true)} /><Label htmlFor="od">Overdue only</Label></div>
      </div>
      {list.isError ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : (
        <>
          <Table className={list.isPlaceholderData ? "min-w-[860px] opacity-60" : "min-w-[860px]"}>
            <Head cols={["Student", "Guardian", ["Open invoices", "text-right"], ["Overdue", "text-right"], ["Opening balance", "text-right"], ["Due", "text-right"]]} />
            <TableBody>
              {list.isPending && <Empty cols={6} text="Loading dues…" />}
              {list.data?.items.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell><p className="font-medium">{r.student_name}{r.status !== "active" && <span className="ml-2 text-xs font-normal text-text-tertiary capitalize">{r.status}</span>}</p><p className="text-xs text-text-tertiary">{r.class_label ? `Class ${r.class_label} · ` : ""}{r.scholar_no}</p></TableCell>
                  <TableCell>{r.guardian_name ?? "—"}{r.guardian_phone && <p className="text-xs text-text-tertiary">{r.guardian_phone}</p>}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.invoices_open}{r.oldest_due_on && <p className="text-xs text-text-tertiary">since {formatDateOn(r.oldest_due_on, "short")}</p>}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.overdue_paise ? <span className="text-danger">{inr(r.overdue_paise)}</span> : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.opening_balance_paise ? inr(r.opening_balance_paise) : "—"}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{inr(r.due_paise)}</TableCell>
                </TableRow>
              ))}
              {list.isSuccess && total === 0 && <Empty cols={6} text="Nobody owes fees." />}
            </TableBody>
          </Table>
          <Pager page={page} pages={Math.max(1, Math.ceil(total / SIZE))} total={total} size={SIZE} setPage={setPage} />
        </>
      )}
    </Card>
  );
}

function RemindersTab() {
  const [overdue, setOverdue] = React.useState(false);
  const [email, setEmail] = React.useState(false);
  const list = useReminders(overdue);
  const send = useSendReminders();
  const [picked, setPicked] = React.useState<string[]>([]);
  const [err, setErr] = React.useState<unknown>(null);
  const rows = list.data ?? [];
  const can = rows.filter((r) => r.can_remind);
  const go = (ids: string[] | null) => {
    setErr(null);
    send.mutate({ student_ids: ids, overdue_only: overdue, email }, {
      onSuccess: (r) => { setPicked([]); toast.success(r.reminded === 1 ? "1 parent reminded" : `${r.reminded} parents reminded`, { description: [r.skipped_recent ? `${r.skipped_recent} skipped (reminded in the last 3 days)` : "", r.emailed ? `${r.emailed} emailed` : ""].filter(Boolean).join(". ") || undefined }); },
      onError: setErr,
    });
  };
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0"><div><CardTitle>Fee reminders</CardTitle><CardDescription>Parents get a notification with the balance and due date. Anyone reminded in the last 3 days is skipped.</CardDescription></div>
        <Button variant="brand" loading={send.isPending} disabled={!can.length} onClick={() => go(picked.length ? picked : null)}><Bell /> {picked.length ? `Send to ${picked.length} selected` : `Send to all (${can.length})`}</Button></CardHeader>
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-2"><Checkbox id="rod" checked={overdue} onCheckedChange={(v) => { setOverdue(v === true); setPicked([]); }} /><Label htmlFor="rod">Overdue only</Label></div>
        <div className="flex items-center gap-2"><Checkbox id="rem" checked={email} onCheckedChange={(v) => setEmail(v === true)} /><Label htmlFor="rem">Also email guardians</Label></div>
      </div>
      <Problem error={err} />
      {list.isError ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : list.isPending ? <LoadingBlock label="Loading reminders" /> : rows.length === 0 ? (
        <EmptyState icon={Wallet} title="Nobody to remind" text="Every active student is paid up." />
      ) : (
        <Table className="min-w-[760px]">
          <Head cols={["", "Student", "Guardian", ["Balance", "text-right"], "Last reminded", ""]} />
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.student_id}>
                <TableCell className="w-10"><Checkbox aria-label={`Select ${r.student_name}`} disabled={!r.can_remind} checked={picked.includes(r.student_id)} onCheckedChange={(v) => setPicked((p) => v === true ? [...p, r.student_id] : p.filter((x) => x !== r.student_id))} /></TableCell>
                <TableCell><p className="font-medium">{r.student_name}</p><p className="text-xs text-text-tertiary">{r.class_label ? `Class ${r.class_label} · ` : ""}{r.scholar_no}</p></TableCell>
                <TableCell>{r.guardian_name ?? "—"}{r.guardian_email && <p className="text-xs text-text-tertiary">{r.guardian_email}</p>}</TableCell>
                <TableCell className="text-right tabular-nums">{inr(r.balance_paise)}{r.overdue && <p className="text-xs text-danger">Overdue</p>}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{r.last_reminded_at ? formatIST(r.last_reminded_at, "short") : "Never"}{!r.can_remind && <p className="text-xs text-text-tertiary">Reminded recently</p>}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="secondary" disabled={!r.can_remind || send.isPending} onClick={() => go([r.student_id])}>Remind</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

const GROUPS = [["day", "By day"], ["head", "By fee head"], ["class", "By class"], ["mode", "By payment mode"]] as const;
function ReportTab() {
  const today = useTodayIST();
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [group, setGroup] = React.useState<string>("day");
  const f = from || (today ? monthStartOf(today) : ""), t = to || today;
  const rep = useCollection(f, t, group);
  const label = (k: string, l: string) => (group === "day" ? formatDateOn(k, "date") : group === "mode" ? MODE_NAME[k] ?? l : l);
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0"><div><CardTitle>Collection report</CardTitle><CardDescription>Money received between two dates (IST). Cancelled payments are shown apart and never counted.</CardDescription></div>
        <ExcelButton path="/fees/reports/collection/export" params={{ date_from: f, date_to: t, group_by: group }} fallbackName="fee-collection.xlsx" disabled={!f || !t} /></CardHeader>
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="From date (IST)" type="date" className="w-44" value={f} max={t || undefined} onChange={(e) => setFrom(e.target.value)} />
        <Input aria-label="To date (IST)" type="date" className="w-44" value={t} min={f || undefined} onChange={(e) => setTo(e.target.value)} />
        <Tabs value={group} onValueChange={setGroup}><TabsList>{GROUPS.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList></Tabs>
      </div>
      {rep.isError ? <ErrorBlock error={rep.error} onRetry={() => rep.refetch()} /> : !rep.data ? <LoadingBlock label="Loading report" /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Collected" value={inr(rep.data.total_paise)} hint={`${rep.data.payments} ${rep.data.payments === 1 ? "payment" : "payments"}`} />
            <StatCard label="Cancelled" value={inr(rep.data.cancelled_paise)} hint={`${rep.data.cancelled_count} cancelled, not counted`} />
          </div>
          <Table>
            <Head cols={[GROUPS.find((g) => g[0] === group)![1].replace("By ", "").replace(/^./, (c) => c.toUpperCase()), ["Payments", "text-right"], ["Amount", "text-right"]]} />
            <TableBody>
              {rep.data.rows.map((r) => <TableRow key={r.key}><TableCell className="font-medium">{label(r.key, r.label)}</TableCell><TableCell className="text-right tabular-nums">{r.count}</TableCell><TableCell className="text-right tabular-nums">{inr(r.amount_paise)}</TableCell></TableRow>)}
              {rep.data.rows.length === 0 && <Empty cols={3} text="No payments in this period." />}
            </TableBody>
          </Table>
        </>
      )}
    </Card>
  );
}
