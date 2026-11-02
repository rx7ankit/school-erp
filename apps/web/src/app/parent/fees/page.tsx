"use client";
import { isLive } from "@/lib/api/config";
import { FeesLive } from "@/components/parent/fees-live";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceLines } from "@/components/app/fees/invoice-lines";
import { PaymentList } from "@/components/app/fees/payment-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { invoicesOf, isClosed, useFeesStore } from "@/lib/fees-setup";
import { invoiceStatus, type Invoice } from "@/lib/mock";
import { downloadReceiptPdf, receiptFor } from "@/lib/receipt";
import { useFmt } from "@/lib/lang-context";
import { useData, useT } from "@/lib/parent-i18n";

const TONE = { paid: "success", partial: "warning", unpaid: "danger" } as const;

function InvoiceCard({ inv }: { inv: Invoice }) {
  const t = useT(), d = useData(), f = useFmt();
  const closed = isClosed(inv), status = invoiceStatus(inv);
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>{d(inv.period)} · {inv.no}</CardTitle><CardDescription>{t("fee.due", { date: f.on(inv.dueOn) })}</CardDescription></div>
        {closed ? <Badge>{t("fee.closed")}</Badge> : <Badge tone={TONE[status]}>{t(`inv.${status}`)}</Badge>}
      </CardHeader>
      <InvoiceLines inv={inv} />
      <h3 className="mb-3 mt-6 text-[15px] font-bold">{t("fee.payments")}</h3>
      <PaymentList payments={inv.payments} audience="parent" onReceipt={(p) => downloadReceiptPdf(receiptFor(inv, p))} />
    </Card>
  );
}

function ParentFeesDemo() {
  const t = useT();
  useFeesStore();
  const sel = useChild();
  if (!sel) return null;
  // Newest invoice first. Closed ones (carried into a newer invoice) go last.
  const list = invoicesOf(sel.child.id).reverse().sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)));
  return (
    <>
      <PageHeader title={t("fee.title")} />
      {!list.length ? <Card className="text-sm text-muted-foreground">{t("fee.empty")}</Card> : list.map((inv) => <InvoiceCard key={inv.id} inv={inv} />)}
    </>
  );
}

export default function ParentFees() {
  return isLive ? <FeesLive /> : <ParentFeesDemo />;
}
