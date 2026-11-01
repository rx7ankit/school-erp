"use client";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { invoiceStatus } from "@/lib/mock";
import { invoiceFor } from "@/lib/parent-data";
import { formatDateOn, formatINR, formatIST } from "@/lib/time";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadReceiptPdf, receiptFor } from "@/lib/receipt";

const TONE = { paid: "success", partial: "warning", unpaid: "danger" } as const;
const MODE = { cash: "Cash", cheque: "Cheque", upi: "UPI", bank_transfer: "Bank transfer" } as const;

export default function ParentFees() {
  const sel = useChild();
  if (!sel) return null;
  const inv = invoiceFor(sel.child);
  return (
    <>
      <PageHeader eyebrow={sel.child.name} title="Fees." dim="Paid at the school office." />
      {!inv ? <Card className="text-sm text-muted-foreground">No invoices yet.</Card> : (
        <Card>
          <CardHeader>
            <div><CardTitle>{inv.period} · {inv.no}</CardTitle><CardDescription>Due {formatDateOn(inv.dueOn)}</CardDescription></div>
            <Badge tone={TONE[invoiceStatus(inv)]} className="capitalize">{invoiceStatus(inv)}</Badge>
          </CardHeader>
          <dl className="grid grid-cols-[1fr_auto] gap-y-3 text-sm">
            <dt className="text-muted-foreground">Total</dt><dd className="font-medium tabular-nums">{formatINR(inv.totalPaise)}</dd>
            <dt className="text-muted-foreground">Paid</dt><dd className="font-medium tabular-nums">{formatINR(inv.paidPaise)}</dd>
            <dt className="font-bold">Balance</dt><dd className="text-lg font-bold tabular-nums">{formatINR(inv.totalPaise - inv.paidPaise)}</dd>
          </dl>
          {inv.paidPaise > 0 && inv.lastPaymentAt && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fill px-4 py-3 text-sm"><div><p className="font-medium">Receipt · {formatINR(inv.paidPaise)}</p><p className="text-muted-foreground">{inv.mode ? MODE[inv.mode] : ""} · {formatIST(inv.lastPaymentAt)} IST</p></div><Button size="sm" variant="brand" onClick={() => downloadReceiptPdf(receiptFor(inv))}><Download /> Download receipt</Button></div>
          )}
          <p className="mt-5 text-sm text-muted-foreground">Please pay at the school office. The balance updates here once the office records your payment.</p>
        </Card>
      )}
    </>
  );
}
