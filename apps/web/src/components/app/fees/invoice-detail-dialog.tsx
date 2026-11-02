"use client";
import * as React from "react";
import { toast } from "sonner";
import { Percent, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { balanceOf, cancelPayment, isClosed, useFeesStore, waiveLateFee } from "@/lib/fees-setup";
import { STUDENTS, className, invoiceStatus, type FeePayment, type Invoice } from "@/lib/mock";
import { receiptFor, type Receipt } from "@/lib/receipt";
import { formatDateOn, formatINR } from "@/lib/time";
import { InvoiceLines } from "./invoice-lines";
import { PaymentList } from "./payment-list";
import { ReasonDialog } from "./reason-dialog";

const TONE = { paid: "success", partial: "warning", unpaid: "danger" } as const;

/** Full invoice: lines, totals and payments, with cancel, waive and record actions. */
export function InvoiceDetailDialog({ invoice, by, onClose, onRecord, onReceipt }: {
  invoice: Invoice | null; by: string; onClose: () => void; onRecord: (inv: Invoice) => void; onReceipt: (r: Receipt) => void;
}) {
  useFeesStore();
  const [cancel, setCancel] = React.useState<FeePayment | null>(null);
  const [waive, setWaive] = React.useState(false);
  const s = invoice && STUDENTS.find((x) => x.id === invoice.studentId);
  const closed = invoice ? isClosed(invoice) : false;
  const status = invoice ? invoiceStatus(invoice) : "unpaid";
  const lateFee = invoice?.items.find((i) => i.kind === "late_fee" && i.amountPaise > 0);
  return (
    <>
      <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-xl">
          {invoice && s && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-3">{invoice.no}
                  {closed ? <Badge>Closed</Badge> : <Badge tone={TONE[status]} className="capitalize">{status}</Badge>}</DialogTitle>
                <DialogDescription>{s.name} · Class {className(s.classId)} · {invoice.period} · {formatDateOn(invoice.dueOn)}</DialogDescription>
              </DialogHeader>
              <section aria-label="Invoice lines" className="rounded-xl bg-card p-4"><InvoiceLines inv={invoice} /></section>
              <section aria-label="Payments" className="flex flex-col gap-3">
                <div className="flex items-center justify-between"><h3 className="text-[15px] font-bold">Payments</h3>
                  <div className="flex gap-2">
                    {lateFee && !closed && <Button size="sm" variant="secondary" onClick={() => setWaive(true)}><Percent /> Waive late fee</Button>}
                    {!closed && balanceOf(invoice) > 0 && <Button size="sm" variant="brand" onClick={() => onRecord(invoice)}><Plus /> Record payment</Button>}
                  </div>
                </div>
                <PaymentList payments={invoice.payments} audience="staff" onReceipt={(p) => onReceipt(receiptFor(invoice, p))} onCancel={setCancel} />
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ReasonDialog open={!!cancel && !!invoice} onClose={() => setCancel(null)} title="Cancel payment?"
        description="Stays on record as cancelled."
        summary={cancel && <span>{formatINR(cancel.amountPaise)} · {cancel.receiptNo}</span>}
        acknowledge="Balance goes up and the receipt shows cancelled."
        confirmLabel="Cancel payment"
        onConfirm={(reason) => {
          if (!invoice || !cancel) return "Payment not found";
          const r = cancelPayment(invoice, cancel.id, reason, by);
          if (!r.ok) return r.error;
          toast.success(`Cancelled ${cancel.receiptNo}`);
          return null;
        }} />
      <ReasonDialog open={waive && !!lateFee} onClose={() => setWaive(false)} title="Waive late fee?"
        description=""
        summary={lateFee && <span>Late fee {formatINR(lateFee.amountPaise)}</span>} confirmLabel="Waive" danger={false}
        onConfirm={(reason) => {
          if (!invoice) return "Invoice not found";
          const r = waiveLateFee(invoice, reason, by);
          if (!r.ok) return r.error;
          toast.success("Late fee waived");
          return null;
        }} />
    </>
  );
}
