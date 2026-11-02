"use client";
import * as React from "react";
import { BookOpen, FileDown, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { Loaded } from "@/components/parent/live-ui";
import { useParentCertificates, useParentLibrary, type ParentCertificate } from "@/lib/api/hooks/parent";
import { useData, useFmt } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";
import { downloadCertificate } from "@/lib/certificates";
import type { Certificate } from "@/lib/student-record";
import { formatINR } from "@/lib/time";

/** The API certificate drawn by the existing (English) certificate PDF, from the snapshot the school froze at issue. */
function toPdf(c: ParentCertificate, studentId: string): Certificate {
  const s = c.snapshot as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: c.id, studentId, kind: c.kind as Certificate["kind"], number: c.number, issuedOn: c.issued_on, issuedBy: "", reason: "",
    snapshot: {
      school: s.school?.name ?? "", city: s.school?.city ?? "", academicYear: s.academic_year ?? "", studentName: s.student?.name ?? "",
      gender: /^m/i.test(s.student?.gender ?? "") ? "M" : "F", guardian: s.guardian?.name ?? "", dob: s.student?.dob ?? c.issued_on,
      className: s.class ?? "", scholarNo: s.student?.scholar_no ?? "", admittedOn: s.student?.admitted_on ?? c.issued_on,
      leftOn: s.left_on ?? undefined, leavingReason: c.kind === "transfer" ? s.reason ?? undefined : undefined, conduct: s.conduct ?? undefined, purpose: s.purpose ?? undefined,
    },
  };
}

export function RecordsLive() {
  const t = useT(), d = useData(), f = useFmt();
  const sel = useChild();
  const certs = useParentCertificates(sel?.child.id ?? "");
  const lib = useParentLibrary(sel?.child.id ?? "");
  if (!sel) return null;
  const sid = sel.child.id;
  const kindName = (k: string) => (k === "transfer" || k === "bonafide" || k === "character" ? t(`cert.${k}`) : k);
  return (
    <>
      <PageHeader eyebrow={sel.child.name} title={t("rec.title")} dim={t("rec.dim")} />
      <Card>
        <CardHeader><CardTitle>{t("cert.title")}</CardTitle></CardHeader>
        <Loaded q={certs} loading={<p className="text-sm text-muted-foreground">{t("app.loading")}</p>}>
          {(rows) => rows.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><ScrollText className="size-4" />{t("cert.none")}</p> : (
            <ul>{rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                <div className="min-w-0"><p className="font-medium">{kindName(c.kind)}</p><p className="text-xs tabular-nums text-muted-foreground">{c.number} · {t("cert.issued", { date: f.on(c.issued_on) })}</p></div>
                <Button size="sm" variant="secondary" onClick={() => { try { downloadCertificate(toPdf(c, sid)); toast.success(t("cert.done", { no: c.number })); } catch { toast.error(t("pl.error")); } }}><FileDown /> {t("cert.download")}</Button>
              </li>))}</ul>
          )}
        </Loaded>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("lib.title")}</CardTitle>{(lib.data?.overdue_count ?? 0) > 0 && <Badge tone="danger">{t("lib.overdue", { n: lib.data!.overdue_count })}</Badge>}</CardHeader>
        <Loaded q={lib} loading={<p className="text-sm text-muted-foreground">{t("app.loading")}</p>}>
          {(l) => <>{l.current.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="size-4" />{t("lib.none")}</p> : (
            <ul>{l.current.map((b) => (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                <div className="min-w-0"><p className="font-medium">{d(b.title)}</p><p className="text-xs text-muted-foreground">{b.author} · {b.accession_no}</p></div>
                <div className="text-right text-xs tabular-nums">
                  <p className={b.overdue ? "font-medium text-danger" : "text-muted-foreground"}>{t("lib.due", { date: f.on(b.due_on) })}</p>
                  {b.overdue && <p className="text-danger">{t("lib.late", { n: b.days_overdue })}{b.fine_paise > 0 ? ` · ${t("lib.fine", { amount: formatINR(b.fine_paise) })}` : ""}</p>}
                </div>
              </li>))}</ul>
          )}
          {l.fines.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium">{t("lib.fines")}</p>
              <ul>{l.fines.map((x) => (
                <li key={x.loan_id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{d(x.title)}</span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums"><span>{formatINR(x.fine_paise)}</span>
                    <Badge tone={x.fine_paid ? "success" : x.fine_status === "closed" ? "neutral" : "danger"}>{x.fine_paid ? t("lib.finePaid") : x.fine_status === "partial" ? t("lib.finePartial", { amount: formatINR(x.balance_paise) }) : x.fine_status === "closed" ? t("lib.fineClosed") : t("lib.fineUnpaid")}</Badge></span>
                </li>))}</ul>
            </div>
          )}</>}
        </Loaded>
      </Card>
    </>
  );
}
