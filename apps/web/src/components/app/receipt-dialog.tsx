"use client";
import * as React from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MODE_LABEL, downloadReceiptPdf, rupeesInWords, type Receipt } from "@/lib/receipt";
import { formatINR, formatIST } from "@/lib/time";

/** The printable sheet. Only this element prints (see the @media print rules in globals.css). */
export function ReceiptSheet({ r }: { r: Receipt }) {
  const rows: [string, string][] = [
    ["Student", r.student], ["Class", r.className], ["Scholar no.", r.scholarNo], ["Invoice", `${r.invoiceNo} · ${r.period}`],
    ["Date and time", `${formatIST(r.at)} IST`], ["Paid by", MODE_LABEL[r.mode] + (r.reference ? ` (${r.reference})` : "")], ["Received by", r.receivedBy],
  ];
  return (
    <div id="receipt-print" className="rounded-2xl bg-card p-6 text-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div><p className="text-lg font-bold leading-tight">{r.school}</p><p className="text-xs text-muted-foreground">{r.city}</p></div>
        <div className="text-right"><p className="text-xs font-bold tracking-[0.08em]">FEE RECEIPT</p><p className="text-xs text-muted-foreground">No. {r.no}</p></div>
      </div>
      <dl className="grid grid-cols-[110px_1fr] gap-y-2.5 py-4">
        {rows.map(([k, v]) => (<React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></React.Fragment>))}
      </dl>
      <div className="rounded-xl bg-fill p-4">
        <p className="text-xs text-muted-foreground">Amount received</p>
        <p className="text-[28px] font-bold tabular-nums leading-tight">{formatINR(r.amountPaise)}</p>
        <p className="text-xs text-muted-foreground">{rupeesInWords(r.amountPaise)}</p>
      </div>
      <p className="mt-4 flex justify-between"><span className="text-muted-foreground">Balance due</span><b className="tabular-nums">{formatINR(r.balancePaise)}</b></p>
      <p className="mt-4 text-[11px] text-text-tertiary">This is a computer generated receipt and needs no signature.</p>
    </div>
  );
}

export function ReceiptDialog({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Receipt</DialogTitle><DialogDescription>Print it or save a PDF to share on WhatsApp.</DialogDescription></DialogHeader>
        {receipt && <ReceiptSheet r={receipt} />}
        <DialogFooter>
          <Button variant="secondary" onClick={() => window.print()}><Printer /> Print</Button>
          <Button variant="brand" onClick={() => receipt && downloadReceiptPdf(receipt)}><Download /> Download PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
