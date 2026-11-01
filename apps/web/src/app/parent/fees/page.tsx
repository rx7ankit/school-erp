"use client";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceLines } from "@/components/app/fees/invoice-lines";
import { PaymentList } from "@/components/app/fees/payment-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { invoicesOf, isClosed, useFeesStore } from "@/lib/fees-setup";
import { invoiceStatus, type Invoice } from "@/lib/mock";
import { downloadReceiptPdf, receiptFor } from "@/lib/receipt";
import { formatDateOn } from "@/lib/time";

const TONE = { paid: "success", partial: "warning", unpaid: "danger" } as const;

function InvoiceCard({ inv }: { inv: Invoice }) {
  const closed = isClosed(inv), status = invoiceStatus(inv);
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>{inv.period} · {inv.no}</CardTitle><CardDescription>Due {formatDateOn(inv.dueOn)}</CardDescription></div>
        {closed ? <Badge>Closed</Badge> : <Badge tone={TONE[status]} className="capitalize">{status}</Badge>}
      </CardHeader>
      <InvoiceLines inv={inv} />
      <h3 className="mb-3 mt-6 text-[15px] font-bold">Payments</h3>
      <PaymentList payments={inv.payments} audience="parent" onReceipt={(p) => downloadReceiptPdf(receiptFor(inv, p))} />
      {!closed && status !== "paid" && <p className="mt-5 text-sm text-muted-foreground">Please pay at the school office. The balance updates here once the office records your payment.</p>}
    </Card>
  );
}

export default function ParentFees() {
  useFeesStore();
  const sel = useChild();
  if (!sel) return null;
  // Newest invoice first. Closed ones (carried into a newer invoice) go last.
  const list = invoicesOf(sel.child.id).reverse().sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)));
  return (
    <>
      <PageHeader eyebrow={sel.child.name} title="Fees." dim="Paid at the school office." />
      {!list.length ? <Card className="text-sm text-muted-foreground">No invoices yet.</Card> : list.map((inv) => <InvoiceCard key={inv.id} inv={inv} />)}
    </>
  );
}
