import { balanceOf, closedNote, waiverOf } from "@/lib/fees-setup";
import type { Invoice } from "@/lib/mock";
import { formatINR, formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Every line of an invoice, then total, paid and balance. Used by staff and parents. */
export function InvoiceLines({ inv }: { inv: Invoice }) {
  const waiver = waiverOf(inv), closed = closedNote(inv);
  const tone = (k: string, amount: number) => (k === "discount" ? "text-success" : k === "late_fee" && amount > 0 ? "text-danger" : "");
  return (
    <div className="text-sm">
      <ul className="flex flex-col">
        {inv.items.map((i) => (
          <li key={i.id} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 first:pt-0">
            <span className={cn(i.kind === "late_fee" && i.amountPaise === 0 && "text-muted-foreground line-through")}>
              {i.label}
              {i.kind === "carried_forward" && <span className="ml-2 text-xs text-text-tertiary">carried forward</span>}
              {i.kind === "discount" && <span className="ml-2 text-xs text-text-tertiary">concession</span>}
            </span>
            <span className={cn("tabular-nums", tone(i.kind, i.amountPaise))}>{i.amountPaise < 0 ? `−${formatINR(-i.amountPaise)}` : formatINR(i.amountPaise)}</span>
          </li>
        ))}
      </ul>
      {waiver && <p className="mt-2 text-xs text-text-tertiary">Late fee of {formatINR(waiver.amountPaise)} waived by {waiver.by} on {formatIST(waiver.at)} IST. Reason: {waiver.reason}</p>}
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-2">
        <dt className="text-muted-foreground">Total</dt><dd className="text-right font-medium tabular-nums">{formatINR(inv.totalPaise)}</dd>
        <dt className="text-muted-foreground">Paid</dt><dd className="text-right font-medium tabular-nums">{formatINR(inv.paidPaise)}</dd>
        <dt className="font-bold">Balance</dt><dd className="text-right text-lg font-bold tabular-nums">{formatINR(balanceOf(inv))}</dd>
      </dl>
      {closed && <p className="mt-2 text-xs text-text-tertiary">Closed. The unpaid balance was carried forward to {closed}.</p>}
    </div>
  );
}
