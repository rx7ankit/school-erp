import { balanceOf, closedNote, owedOf, waiverOf } from "@/lib/fees-setup";
import type { Invoice } from "@/lib/mock";
import { formatINR } from "@/lib/time";
import { useData, useFmt, useTr } from "@/lib/lang-context";
import { cn } from "@/lib/utils";

/** Every line of an invoice, then total, paid and balance. Used by staff and parents. */
export function InvoiceLines({ inv }: { inv: Invoice }) {
  const tr = useTr(), d = useData(), f = useFmt();
  const waiver = waiverOf(inv), closed = closedNote(inv);
  const tone = (k: string, amount: number) => (k === "discount" ? "text-success" : k === "late_fee" && amount > 0 ? "text-danger" : "");
  return (
    <div className="text-sm">
      <ul className="flex flex-col">
        {inv.items.map((i) => (
          <li key={i.id} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 first:pt-0">
            <span className={cn(i.kind === "late_fee" && i.amountPaise === 0 && "text-muted-foreground line-through")}>
              {d(i.label)}
              {i.kind === "carried_forward" && <span className="ml-2 text-xs text-text-tertiary">{tr("fee.carried", "carried forward")}</span>}
              {i.kind === "discount" && <span className="ml-2 text-xs text-text-tertiary">{tr("fee.concession", "concession")}</span>}
            </span>
            <span className={cn("tabular-nums", tone(i.kind, i.amountPaise))}>{i.amountPaise < 0 ? `−${formatINR(-i.amountPaise)}` : formatINR(i.amountPaise)}</span>
          </li>
        ))}
      </ul>
      {waiver && <p className="mt-2 text-xs text-text-tertiary">{tr("fee.waived", "Late fee of {amount} waived by {by} on {date} IST. Reason: {reason}", { amount: formatINR(waiver.amountPaise), by: waiver.by, date: f.ist(waiver.at), reason: waiver.reason })}</p>}
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-2">
        <dt className="text-muted-foreground">{tr("fee.total", "Total")}</dt><dd className="text-right font-medium tabular-nums">{formatINR(inv.totalPaise)}</dd>
        <dt className="text-muted-foreground">{tr("fee.paid", "Paid")}</dt><dd className="text-right font-medium tabular-nums">{formatINR(inv.paidPaise)}</dd>
        <dt className="font-bold">{tr("fee.balance", "Balance")}</dt><dd className="text-right text-lg font-bold tabular-nums">{formatINR(owedOf(inv))}</dd>
      </dl>
      {closed && <p className="mt-2 text-xs text-text-tertiary">{tr("fee.closedNote", "Closed. The unpaid {amount} was carried forward to {to}.", { amount: formatINR(balanceOf(inv)), to: closed })}</p>}
    </div>
  );
}
