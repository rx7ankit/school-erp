import { Ban, Download, Receipt as ReceiptIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelledByOf } from "@/lib/fees-setup";
import type { FeePayment } from "@/lib/mock";
import { MODE_LABEL } from "@/lib/receipt";
import { formatINR } from "@/lib/time";
import { useFmt, useTr } from "@/lib/lang-context";
import { cn } from "@/lib/utils";

/**
 * Payments (instalments) of one invoice. Cancelled ones stay, struck through.
 * Staff see who cancelled and why; parents see "Cancelled by school" and cannot download.
 */
export function PaymentList({ payments, audience, onReceipt, onCancel }: {
  payments: FeePayment[]; audience: "staff" | "parent"; onReceipt: (p: FeePayment) => void; onCancel?: (p: FeePayment) => void;
}) {
  const tr = useTr(), f = useFmt();
  if (!payments.length) return <p className="rounded-xl bg-fill px-4 py-3 text-sm text-muted-foreground">{tr("fee.noPayments", "No payments yet.")}</p>;
  const ordered = [...payments].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((p, n) => {
        const off = p.status === "cancelled";
        return (
          <li key={p.id} className="rounded-xl bg-fill px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={cn("font-bold tabular-nums", off && "text-muted-foreground line-through")}>{formatINR(p.amountPaise)}</span>
                  <span className="text-xs text-text-tertiary">{tr("fee.instalment", "Instalment {n}", { n: n + 1 })}</span>
                  {off && <Badge tone="danger">{audience === "parent" ? tr("fee.cancelledBySchool", "Cancelled by school") : "Cancelled"}</Badge>}
                </p>
                <p className={cn("mt-0.5 text-xs text-muted-foreground", off && "line-through")}>
                  {tr(`mode.${p.mode}`, MODE_LABEL[p.mode])}{p.reference ? ` · ${p.reference}` : ""} · {p.receiptNo} · {f.ist(p.at)} IST
                </p>
                {audience === "staff" && <p className="text-xs text-text-tertiary">Received by {p.receivedBy}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                {!off && audience === "staff" && <Button size="sm" variant="secondary" onClick={() => onReceipt(p)}><ReceiptIcon /> Receipt</Button>}
                {!off && audience === "parent" && <Button size="sm" variant="secondary" onClick={() => onReceipt(p)}><Download /> {tr("fee.receipt", "Download receipt")}</Button>}
                {!off && onCancel && <Button size="sm" variant="ghost" className="text-danger" onClick={() => onCancel(p)}><Ban /> Cancel</Button>}
              </div>
            </div>
            {off && audience === "staff" && (
              <p className="mt-2 text-xs text-danger">
                Cancelled by {cancelledByOf(p.id) ?? "staff"}{p.cancelledAt ? ` on ${f.ist(p.cancelledAt)} IST` : ""}. Reason: {p.cancelReason}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
