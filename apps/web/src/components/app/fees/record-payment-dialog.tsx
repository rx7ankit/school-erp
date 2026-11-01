"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/app/field";
import { addPayment, balanceOf } from "@/lib/fees-setup";
import { STUDENTS, type FeeMode, type FeePayment, type Invoice } from "@/lib/mock";
import { formatINR } from "@/lib/time";
import { usePending } from "@/lib/use-pending";

/** Records one instalment, up to the balance. */
export function RecordPaymentDialog({ invoice, by, onClose, onSaved }: {
  invoice: Invoice | null; by: string; onClose: () => void; onSaved: (inv: Invoice, p: FeePayment) => void;
}) {
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{invoice && <Body key={invoice.id} {...{ invoice, by, onClose, onSaved }} />}</DialogContent>
    </Dialog>
  );
}

function Body({ invoice, by, onClose, onSaved }: { invoice: Invoice; by: string; onClose: () => void; onSaved: (inv: Invoice, p: FeePayment) => void }) {
  const due = balanceOf(invoice);
  const { run, is } = usePending();
  const [error, setError] = React.useState("");
  const student = STUDENTS.find((s) => s.id === invoice.studentId);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const paise = Math.round(Number(f.get("amount")) * 100);
    if (!(paise > 0) || paise > due) { setError(`Enter an amount up to ${formatINR(due)}`); return; }
    setError("");
    const mode = f.get("mode") as FeeMode, reference = String(f.get("ref") || "");
    if (mode !== "cash" && !reference.trim()) { setError("Add the cheque, UPI or transfer reference"); return; }
    run("pay", () => {
      const r = addPayment(invoice, { amountPaise: paise, mode, reference, by });
      if (!r.ok || !r.payment) { setError(r.ok ? "Could not save" : r.error); return; }
      toast.success(`Recorded ${formatINR(paise)}`, { description: `Receipt ${r.payment.receiptNo}` });
      onSaved(invoice, r.payment);
      onClose();
    });
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>{student?.name} · {invoice.no} · {formatINR(due)} due. Part payments are fine; each one gets its own receipt.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Amount received (₹)" htmlFor="pay-amount"><Input id="pay-amount" name="amount" inputMode="decimal" defaultValue={due / 100} required /></Field>
        <Field label="Paid by" htmlFor="pay-mode"><NativeSelect id="pay-mode" name="mode"><option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="bank_transfer">Bank transfer</option></NativeSelect></Field>
        <Field label="Reference" htmlFor="pay-ref" hint="Cheque number or UPI reference. Not needed for cash."><Input id="pay-ref" name="ref" /></Field>
        <p className="text-xs text-text-tertiary">Time of receipt is recorded automatically in IST.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={is("pay")}>Save payment</Button></DialogFooter>
      </form>
    </>
  );
}
