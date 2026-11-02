"use client";
import * as React from "react";
import { Ban, Download, Printer, Receipt as ReceiptIcon } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Problem } from "@/components/app/bits-a3";
import { LoadingBlock, ErrorBlock } from "@/components/app/academic-live-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { MODE_NAME, useCancelPayment, useInvoice, useReceipt, useRecordPayment, useWaiveLateFee, type PayMode, type Receipt } from "@/lib/api/hooks/fees";
import { inr, parseRupees, rupeesText } from "@/lib/money";
import { downloadReceiptPdf, rupeesInWords, type Receipt as PdfReceipt } from "@/lib/receipt";
import { formatDateOn, formatIST } from "@/lib/time";

export const STATUS_TONE = { paid: "success", partial: "warning", unpaid: "danger", closed: "neutral" } as const;

/** The API receipt in the shape the existing PDF drawing code understands. */
const forPdf = (r: Receipt): PdfReceipt => ({
  no: r.receipt_no, school: r.school_name, city: "", student: r.student_name, className: r.class_label ?? "", scholarNo: r.scholar_no, invoiceNo: r.invoice_no, period: r.period_label,
  amountPaise: r.amount_paise, mode: r.mode as PdfReceipt["mode"], reference: r.reference ?? undefined, at: r.received_at, receivedBy: r.received_by_name ?? "", balancePaise: 0,
});

/** Receipt printed from the API's JSON. Only this element prints (see the @media print rules in globals.css). */
function ReceiptSheet({ r }: { r: Receipt }) {
  const cancelled = r.status !== "active";
  const rows: [string, string][] = [
    ["Student", r.student_name], ["Class", r.class_label ?? "—"], ["Scholar no.", r.scholar_no], ["Invoice", `${r.invoice_no} · ${r.period_label}`],
    ["Date and time", `${formatIST(r.received_at)} IST`], ["Paid by", (MODE_NAME[r.mode] ?? r.mode) + (r.reference ? ` (${r.reference})` : "")], ["Received by", r.received_by_name ?? "—"],
  ];
  return (
    <div id="receipt-print" className="rounded-2xl bg-card p-6 text-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <p className="text-lg font-bold leading-tight">{r.school_name}</p>
        <div className="text-right"><p className="text-xs font-bold tracking-[0.08em]">FEE RECEIPT</p><p className="text-xs text-muted-foreground">No. {r.receipt_no}</p></div>
      </div>
      {cancelled && <p className="mt-4 rounded-xl bg-fill px-4 py-2.5 font-medium text-danger">{r.status_label}{r.cancelled_at ? ` on ${formatIST(r.cancelled_at)} IST` : ""}{r.cancel_reason ? `. Reason: ${r.cancel_reason}` : ""}</p>}
      <dl className="grid grid-cols-[110px_1fr] gap-y-2.5 py-4">
        {rows.map(([k, v]) => (<React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></React.Fragment>))}
      </dl>
      <div className="rounded-xl bg-fill p-4">
        <p className="text-xs text-muted-foreground">{cancelled ? "Amount (cancelled, not counted)" : "Amount received"}</p>
        <p className={`text-[28px] font-bold tabular-nums leading-tight ${cancelled ? "line-through" : ""}`}>{inr(r.amount_paise)}</p>
        <p className="text-xs text-muted-foreground">{rupeesInWords(r.amount_paise)}</p>
      </div>
      <p className="mt-4 text-[11px] text-text-tertiary">This is a computer generated receipt and needs no signature.</p>
    </div>
  );
}

/** Opens a receipt by payment id (fetched from the API) or shows one just returned by a payment. */
export function LiveReceiptDialog({ paymentId, receipt, onClose }: { paymentId: string | null; receipt?: Receipt | null; onClose: () => void }) {
  const q = useReceipt(receipt ? null : paymentId);
  const r = receipt ?? q.data ?? null;
  return (
    <Dialog open={!!paymentId || !!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Receipt</DialogTitle><DialogDescription>Print it or save a PDF to share on WhatsApp.</DialogDescription></DialogHeader>
        {r ? <ReceiptSheet r={r} /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : <LoadingBlock label="Loading receipt" />}
        <DialogFooter>
          <Button variant="secondary" disabled={!r} onClick={() => window.print()}><Printer /> Print</Button>
          <Button variant="brand" disabled={!r || r.status !== "active"} onClick={() => r && downloadReceiptPdf(forPdf(r))}><Download /> Download PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PayTarget { id: string; invoice_no: string; student_name: string; balance_paise: number }

/** Cash, UPI or cheque. A reference is needed for everything except cash (the API enforces this too). */
export function LiveRecordPaymentDialog({ invoice, onClose, onSaved }: { invoice: PayTarget | null; onClose: () => void; onSaved: (r: Receipt) => void }) {
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{invoice && <PayForm key={invoice.id} invoice={invoice} onClose={onClose} onSaved={onSaved} />}</DialogContent>
    </Dialog>
  );
}
function PayForm({ invoice, onClose, onSaved }: { invoice: PayTarget; onClose: () => void; onSaved: (r: Receipt) => void }) {
  const pay = useRecordPayment();
  const [amount, setAmount] = React.useState(rupeesText(invoice.balance_paise));
  const [mode, setMode] = React.useState<PayMode>("cash");
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<unknown>(null);
  const paise = parseRupees(amount);
  const bad = paise === null || paise <= 0 ? "Enter an amount in rupees, for example 1500 or 1500.50." : paise > invoice.balance_paise ? `The balance is only ${inr(invoice.balance_paise)}.` : null;
  const needRef = mode !== "cash";
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (bad || paise === null) return;
      setErr(null);
      pay.mutate({ invoiceId: invoice.id, amount_paise: paise, mode, reference: reference.trim() || null, note: note.trim() || null }, {
        onSuccess: (r) => { toast.success(`Payment recorded. Receipt ${r.receipt_no}`); onClose(); onSaved(r); },
        onError: setErr,
      });
    }} className="flex flex-col gap-4">
      <DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>{invoice.student_name} · {invoice.invoice_no} · balance {inr(invoice.balance_paise)}</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)" htmlFor="pay-amount"><Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!bad} autoFocus /></Field>
        <Field label="Paid by" htmlFor="pay-mode">
          <NativeSelect id="pay-mode" value={mode} onChange={(e) => setMode(e.target.value as PayMode)}>
            {(["cash", "upi", "cheque", "bank_transfer", "online"] as const).map((m) => <option key={m} value={m}>{MODE_NAME[m]}</option>)}
          </NativeSelect>
        </Field>
      </div>
      {needRef && <Field label={mode === "cheque" ? "Cheque number" : mode === "upi" ? "UPI transaction ID" : "Reference number"} htmlFor="pay-ref"><Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} /></Field>}
      <Field label="Note (optional)" htmlFor="pay-note"><Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
      {bad && amount.trim() !== "" && <p className="text-sm text-danger">{bad}</p>}
      <Problem error={err} />
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="brand" loading={pay.isPending} disabled={!!bad || (needRef && !reference.trim())}>Record payment</Button>
      </DialogFooter>
    </form>
  );
}

/** Asks why (3 characters or more) before a risky change. The form is mounted only while open, so it starts empty each time. */
export function LiveReasonDialog({ open, onClose, title, description, confirmLabel, onSubmit, pending, error }: {
  open: boolean; onClose: () => void; title: string; description: string; confirmLabel: string; onSubmit: (reason: string) => void; pending: boolean; error: unknown;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{open && <ReasonBody {...{ onClose, title, description, confirmLabel, onSubmit, pending, error }} />}</DialogContent>
    </Dialog>
  );
}
function ReasonBody({ onClose, title, description, confirmLabel, onSubmit, pending, error }: Omit<Parameters<typeof LiveReasonDialog>[0], "open">) {
  const [reason, setReason] = React.useState("");
  return (
    <>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <Field label="Reason" htmlFor="why" hint="At least 3 characters. Kept in the audit log."><Textarea id="why" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="For example: entered against the wrong student" /></Field>
      <Problem error={error} />
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Keep as is</Button>
        <Button variant="destructive" loading={pending} disabled={reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}>{confirmLabel}</Button>
      </DialogFooter>
    </>
  );
}

/** Cancel a payment: the shared reason dialog wired to the API. */
export function CancelPaymentDialog({ payment, onClose }: { payment: { id: string; receipt_no: string; amount_paise: number } | null; onClose: () => void }) {
  const cancel = useCancelPayment();
  const [err, setErr] = React.useState<unknown>(null);
  const close = () => { setErr(null); onClose(); };
  return (
    <LiveReasonDialog open={!!payment} onClose={close} title="Cancel this payment?"
      description={payment ? `Receipt ${payment.receipt_no} for ${inr(payment.amount_paise)} stays on record, marked cancelled. The receipt number is not reused, and the amount is added back to the invoice balance.` : ""}
      confirmLabel="Cancel payment" pending={cancel.isPending} error={err}
      onSubmit={(reason) => payment && cancel.mutate({ id: payment.id, reason }, { onSuccess: () => { toast.success("Payment cancelled"); close(); }, onError: setErr })} />
  );
}

/** One invoice: lines, payments (with receipt and cancel) and the actions that fit its state. */
export function LiveInvoiceDialog({ invoiceId, onClose, onRecord, onReceipt }: {
  invoiceId: string | null; onClose: () => void; onRecord: (i: PayTarget) => void; onReceipt: (paymentId: string) => void;
}) {
  const q = useInvoice(invoiceId);
  const waive = useWaiveLateFee();
  const [cancelP, setCancelP] = React.useState<{ id: string; receipt_no: string; amount_paise: number } | null>(null);
  const [waiveOpen, setWaiveOpen] = React.useState(false);
  const [werr, setWerr] = React.useState<unknown>(null);
  const d = q.data;
  const hasLate = !!d?.items.some((i) => i.kind === "late_fee");
  return (
    <>
      <Dialog open={!!invoiceId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{d ? `${d.invoice_no} · ${d.student_name}` : "Invoice"}</DialogTitle><DialogDescription>{d ? `${d.period_label} · due ${formatDateOn(d.due_on)}${d.class_label ? ` · Class ${d.class_label}` : ""}` : "Loading"}</DialogDescription></DialogHeader>
          {q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : !d ? <LoadingBlock label="Loading invoice" /> : (
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[d.status as keyof typeof STATUS_TONE] ?? "neutral"} className="capitalize">{d.status}</Badge>
                {d.overdue && d.balance_paise > 0 && <Badge tone="danger">Overdue</Badge>}
                {d.late_waived && <Badge>Late fee waived{d.late_waive_reason ? `: ${d.late_waive_reason}` : ""}</Badge>}
                {d.closed_into_invoice_no && <Badge>Carried into {d.closed_into_invoice_no}</Badge>}
              </div>
              <ul className="rounded-xl bg-fill px-4 py-1 text-sm">
                {d.items.map((i) => <li key={i.id} className="flex justify-between gap-3 border-b border-border py-2.5 last:border-b-0"><span>{i.description}</span><span className={`tabular-nums ${i.amount_paise < 0 ? "text-success" : ""}`}>{inr(i.amount_paise)}</span></li>)}
                <li className="flex justify-between py-2.5 font-bold"><span>Total</span><span className="tabular-nums">{inr(d.total_paise)}</span></li>
              </ul>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {([["Paid", d.paid_paise], ["Balance", d.balance_paise]] as const).map(([k, v]) => <div key={k} className="rounded-xl bg-fill px-4 py-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-bold tabular-nums">{inr(v)}</p></div>)}
                <div className="rounded-xl bg-fill px-4 py-3"><p className="text-xs text-muted-foreground">Total</p><p className="font-bold tabular-nums">{inr(d.total_paise)}</p></div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Payments</p>
                {d.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
                  <ul className="flex flex-col gap-2">
                    {d.payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-fill px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className={`font-medium tabular-nums ${p.status !== "active" ? "line-through text-text-tertiary" : ""}`}>{inr(p.amount_paise)} <span className="font-normal text-muted-foreground">· {MODE_NAME[p.mode] ?? p.mode}{p.reference ? ` · ${p.reference}` : ""}</span></p>
                          <p className="text-xs text-text-tertiary">{p.receipt_no} · {formatIST(p.received_at)}{p.received_by_name ? ` · ${p.received_by_name}` : ""}</p>
                          {p.status !== "active" && <p className="text-xs text-danger">Cancelled{p.cancelled_by_name ? ` by ${p.cancelled_by_name}` : ""}{p.cancel_reason ? `: ${p.cancel_reason}` : ""}</p>}
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => onReceipt(p.id)}><ReceiptIcon /> Receipt</Button>
                          {p.status === "active" && <Button size="sm" variant="ghost" onClick={() => setCancelP({ id: p.id, receipt_no: p.receipt_no, amount_paise: p.amount_paise })}><Ban /> Cancel</Button>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {d && (
            <DialogFooter>
              {hasLate && !d.late_waived && d.balance_paise > 0 && <Button variant="secondary" onClick={() => { setWerr(null); setWaiveOpen(true); }}>Waive late fee</Button>}
              {d.balance_paise > 0 && d.status !== "closed" && <Button variant="brand" onClick={() => onRecord(d)}>Record payment</Button>}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <CancelPaymentDialog payment={cancelP} onClose={() => setCancelP(null)} />
      <LiveReasonDialog open={waiveOpen} onClose={() => setWaiveOpen(false)} title="Waive the late fee?" description="The late fee line is removed from this invoice and not added again. The reason is kept in the audit log." confirmLabel="Waive late fee" pending={waive.isPending} error={werr}
        onSubmit={(reason) => d && waive.mutate({ id: d.id, reason }, { onSuccess: () => { toast.success("Late fee waived"); setWaiveOpen(false); }, onError: setWerr })} />
    </>
  );
}
