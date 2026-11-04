"use client";
import * as React from "react";
import { Download, Printer, Receipt as ReceiptIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge as Badge } from "@/components/parent/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useChild } from "@/components/parent-child";
import { ErrorCard, Loaded, LoadingLines, ParentSk } from "@/components/parent/live-ui";
import { fetchParentReceipt, useParentFees, useParentInvoice, type ParentInvoice, type ParentInvoiceRow, type ParentPayment, type ParentReceipt } from "@/lib/api/hooks/parent";
import { useFmt } from "@/lib/lang-context";
import { useData, useT } from "@/lib/parent-i18n";
import { downloadReceiptPdf, rupeesInWords, type Receipt as PdfReceipt } from "@/lib/receipt";
import { formatINR } from "@/lib/time";
import { cn } from "@/lib/utils";

const TONE = { paid: "success", partial: "warning", unpaid: "danger", closed: "neutral" } as const;
const MODES = ["cash", "cheque", "upi", "bank_transfer"] as const;
type Mode = (typeof MODES)[number];
const modeKey = (m: string): `mode.${Mode}` | null => (MODES.includes(m as Mode) ? (`mode.${m as Mode}` as const) : null);
const rupees = (paise: number) => (paise < 0 ? `−${formatINR(-paise)}` : formatINR(paise));

/** The API receipt as the data the (English) receipt PDF draws. */
const forPdf = (r: ParentReceipt, balance: number): PdfReceipt => ({
  no: r.receipt_no, school: r.school_name, city: "", student: r.student_name, className: r.class_label ?? "", scholarNo: r.scholar_no, invoiceNo: r.invoice_no, period: r.period_label,
  amountPaise: r.amount_paise, mode: r.mode as PdfReceipt["mode"], reference: r.reference ?? undefined, at: r.received_at, receivedBy: r.received_by_name ?? "", balancePaise: balance,
});

function ReceiptDialog({ sid, paymentId, balance, onClose }: { sid: string; paymentId: string | null; balance: number; onClose: () => void }) {
  const t = useT(), f = useFmt(), d = useData();
  const [r, setR] = React.useState<ParentReceipt | null>(null);
  const [err, setErr] = React.useState<unknown>(null);
  const [tries, setTries] = React.useState(0);
  React.useEffect(() => {
    if (!paymentId) return;
    let alive = true;
    fetchParentReceipt(sid, paymentId).then((x) => alive && setR(x), (e) => alive && setErr(e));
    return () => { alive = false; setR(null); setErr(null); };
  }, [sid, paymentId, tries]);
  const mk = r ? modeKey(r.mode) : null;
  const rows: [string, string][] = r ? [
    [t("rcp.student"), r.student_name], [t("rcp.class"), r.class_label ?? "—"], [t("rcp.scholar"), r.scholar_no], [t("rcp.invoice"), `${r.invoice_no} · ${d(r.period_label)}`],
    [t("rcp.when"), `${f.ist(r.received_at)} IST`], [t("rcp.paidBy"), (mk ? t(mk) : r.mode) + (r.reference ? ` (${r.reference})` : "")], [t("rcp.by"), r.received_by_name ?? "—"],
  ] : [];
  return (
    <Dialog open={!!paymentId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{t("rcp.title")}</DialogTitle></DialogHeader>
        {r ? (
          <div id="receipt-print" className="rounded-2xl bg-card p-6 text-sm">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <p className="text-lg font-bold leading-tight">{r.school_name}</p>
              <div className="text-right"><p className="text-xs font-bold uppercase tracking-[0.08em]">{t("rcp.title")}</p><p className="text-xs text-muted-foreground">{t("rcp.no", { no: r.receipt_no })}</p></div>
            </div>
            {r.status !== "active" && <p className="mt-4 rounded-xl bg-fill px-4 py-2.5 font-medium text-danger">{t("fee.cancelledBySchool")}</p>}
            <dl className="grid grid-cols-[110px_1fr] gap-y-2.5 py-4">
              {rows.map(([k, v]) => (<React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></React.Fragment>))}
            </dl>
            <div className="rounded-xl bg-fill p-4">
              <p className="text-xs text-muted-foreground">{t("rcp.amount")}</p>
              <p className={cn("text-[28px] font-bold leading-tight tabular-nums", r.status !== "active" && "line-through")}>{formatINR(r.amount_paise)}</p>
              <p className="text-xs text-muted-foreground">{rupeesInWords(r.amount_paise)}</p>
            </div>
            <p className="mt-4 flex justify-between"><span className="text-muted-foreground">{t("rcp.balance")}</span><b className="tabular-nums">{formatINR(balance)}</b></p>
            <p className="mt-4 text-[11px] text-text-tertiary">{t("rcp.note")}</p>
          </div>
        ) : err ? <ErrorCard error={err} retry={() => { setErr(null); setTries((n) => n + 1); }} /> : <LoadingLines lines={5} className="py-2" />}
        <DialogFooter>
          <Button variant="secondary" disabled={!r} onClick={() => window.print()}><Printer /> {t("rcp.print")}</Button>
          <Button disabled={!r || r.status !== "active"} onClick={() => r && downloadReceiptPdf(forPdf(r, balance))}><Download /> {t("rcp.pdf")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Payments({ payments, onReceipt }: { payments: ParentPayment[]; onReceipt: (p: ParentPayment) => void }) {
  const t = useT(), f = useFmt();
  if (!payments.length) return <p className="rounded-xl bg-fill px-4 py-3 text-sm text-muted-foreground">{t("fee.noPayments")}</p>;
  const ordered = [...payments].sort((a, b) => a.received_at.localeCompare(b.received_at));
  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((p, n) => {
        const off = p.status !== "active", mk = modeKey(p.mode);
        return (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fill px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className={cn("font-bold tabular-nums", off && "text-muted-foreground line-through")}>{formatINR(p.amount_paise)}</span>
                <span className="text-xs text-text-tertiary">{t("fee.instalment", { n: n + 1 })}</span>
                {off && <Badge tone="danger">{t("fee.cancelledBySchool")}</Badge>}
              </p>
              <p className={cn("mt-0.5 text-xs text-muted-foreground", off && "line-through")}>{mk ? t(mk) : p.mode}{p.reference ? ` · ${p.reference}` : ""} · {p.receipt_no} · {f.ist(p.received_at)} IST</p>
            </div>
            {!off && <Button size="sm" variant="secondary" onClick={() => onReceipt(p)}><ReceiptIcon /> {t("fee.receipt")}</Button>}
          </li>
        );
      })}
    </ul>
  );
}

function InvoiceBody({ inv, onReceipt }: { inv: ParentInvoice; onReceipt: (p: ParentPayment) => void }) {
  const t = useT(), d = useData();
  const closed = inv.status === "closed";
  return (<>
    <ul className="flex flex-col text-sm">
      {inv.items.map((i) => (
        <li key={i.id} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 first:pt-0">
          <span className={cn(i.kind === "late_fee" && i.amount_paise === 0 && "text-muted-foreground line-through")}>
            {d(i.description)}
            {i.kind === "carried_forward" && <span className="ml-2 text-xs text-text-tertiary">{t("fee.carried")}</span>}
            {i.kind === "discount" && <span className="ml-2 text-xs text-text-tertiary">{t("fee.concession")}</span>}
          </span>
          <span className={cn("tabular-nums", i.kind === "discount" && "text-success", i.kind === "late_fee" && i.amount_paise > 0 && "text-danger")}>{rupees(i.amount_paise)}</span>
        </li>
      ))}
    </ul>
    {inv.late_waived && <p className="mt-2 text-xs text-text-tertiary">{inv.late_waive_reason ? t("pl.lateWaivedWhy", { reason: inv.late_waive_reason }) : t("pl.lateWaived")}</p>}
    <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t("fee.total")}</dt><dd className="text-right font-medium tabular-nums">{formatINR(inv.total_paise)}</dd>
      <dt className="text-muted-foreground">{t("fee.paid")}</dt><dd className="text-right font-medium tabular-nums">{formatINR(inv.paid_paise)}</dd>
      <dt className="font-bold">{t("fee.balance")}</dt><dd className="text-right text-lg font-bold tabular-nums">{formatINR(closed ? 0 : inv.balance_paise)}</dd>
    </dl>
    {closed && <p className="mt-2 text-xs text-text-tertiary">{inv.closed_into_invoice_no ? t("fee.closedNote", { amount: formatINR(inv.balance_paise), to: inv.closed_into_invoice_no }) : t("fee.closed")}</p>}
    <h3 className="mb-3 mt-6 text-[15px] font-bold">{t("fee.payments")}</h3>
    <Payments payments={inv.payments} onReceipt={onReceipt} />
  </>);
}

/** An invoice's lines, totals and payments. */
function InvoiceBodySk() {
  const t = useT();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("app.loading")}</span>
      <ul className="flex flex-col text-sm">
        {[0, 1, 2].map((i) => <li key={i} className="flex items-center justify-between gap-4 border-b border-border py-2.5 first:pt-0"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-16" /></li>)}
      </ul>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-16 justify-self-end" /><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-16 justify-self-end" /><Skeleton className="h-5 w-16" /><Skeleton className="h-6 w-20 justify-self-end" /></div>
    </div>
  );
}

function FeesSk() {
  return (
    <ParentSk>
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div><Skeleton className="h-5 w-48" /><Skeleton className="mt-2 h-3 w-32" /></div>
            <Skeleton className="h-7 w-20 rounded-full" />
          </CardHeader>
          <InvoiceBodySk />
        </Card>
      ))}
    </ParentSk>
  );
}

function InvoiceCard({ sid, row, onReceipt }: { sid: string; row: ParentInvoiceRow; onReceipt: (p: ParentPayment, balance: number) => void }) {
  const t = useT(), d = useData(), f = useFmt();
  const q = useParentInvoice(sid, row.id, true);
  const status = row.status as keyof typeof TONE;
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>{d(row.period_label)} · {row.invoice_no}</CardTitle><CardDescription>{t("fee.due", { date: f.on(row.due_on) })}</CardDescription></div>
        {status === "closed" ? <Badge>{t("fee.closed")}</Badge>
          : row.overdue && status !== "paid" ? <Badge tone="danger">{t("pl.overdue")}</Badge>
          : <Badge tone={TONE[status] ?? "neutral"}>{t(`inv.${status === "paid" ? "paid" : status === "partial" ? "partial" : "unpaid"}`)}</Badge>}
      </CardHeader>
      <Loaded q={q} loading={<InvoiceBodySk />}>{(inv) => <InvoiceBody inv={inv} onReceipt={(p) => onReceipt(p, inv.balance_paise)} />}</Loaded>
    </Card>
  );
}

export function FeesLive() {
  const t = useT();
  const sel = useChild();
  const q = useParentFees(sel?.child.id ?? "");
  const [open, setOpen] = React.useState<{ id: string; balance: number } | null>(null);
  if (!sel) return null;
  const sid = sel.child.id;
  return (
    <>
      <PageHeader title={t("fee.title")} />
      <Loaded q={q} loading={<FeesSk />} className="flex flex-col gap-6">
        {(fees) => {
          // Newest invoice first. Closed ones (carried into a newer invoice) go last.
          const list = [...fees.invoices].sort((a, b) => b.due_on.localeCompare(a.due_on)).sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed"));
          return (<>
            {fees.opening_balance_paise > 0 && (
              <Card className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-bold">{t("pl.previousDues")}</p><p className="text-xl font-bold tabular-nums">{formatINR(fees.opening_balance_paise)}</p></Card>
            )}
            {!list.length && fees.opening_balance_paise === 0 ? <Card className="text-sm text-muted-foreground">{t("fee.empty")}</Card>
              : list.map((row) => <InvoiceCard key={row.id} sid={sid} row={row} onReceipt={(p, balance) => setOpen({ id: p.id, balance })} />)}
          </>);
        }}
      </Loaded>
      <ReceiptDialog sid={sid} paymentId={open?.id ?? null} balance={open?.balance ?? 0} onClose={() => setOpen(null)} />
    </>
  );
}
