"use client";
import * as React from "react";
import { FileDown, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useChild } from "@/components/parent-child";
import { Loaded } from "@/components/parent/live-ui";
import { useParentCertificates, type ParentCertificate } from "@/lib/api/hooks/parent";
import { useFmt } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";
import { downloadCertificate } from "@/lib/certificates";
import type { Certificate } from "@/lib/student-record";

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

function RowsSk({ rows = 2 }: { rows?: number }) {
  const t = useT();
  return (
    <div role="status" aria-busy="true"><span className="sr-only">{t("app.loading")}</span>
      <ul>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} aria-hidden="true" className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
          <div className="min-w-0"><Skeleton className="h-4 w-32" /><Skeleton className="mt-1.5 h-3 w-48" /></div><Skeleton className="h-9 w-32 rounded-full" />
        </li>
      ))}
    </ul></div>
  );
}

export function RecordsLive() {
  const t = useT(), f = useFmt();
  const sel = useChild();
  const certs = useParentCertificates(sel?.child.id ?? "");
  if (!sel) return null;
  const sid = sel.child.id;
  const kindName = (k: string) => (k === "transfer" || k === "bonafide" || k === "character" ? t(`cert.${k}`) : k);
  return (
    <>
      <PageHeader title={t("rec.title")} />
      <Card>
        <CardHeader><CardTitle>{t("cert.title")}</CardTitle></CardHeader>
        <Loaded q={certs} loading={<RowsSk />}>
          {(rows) => rows.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><ScrollText className="size-4" />{t("cert.none")}</p> : (
            <ul>{rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                <div className="min-w-0"><p className="font-medium">{kindName(c.kind)}</p><p className="text-xs tabular-nums text-muted-foreground">{c.number} · {t("cert.issued", { date: f.on(c.issued_on) })}</p></div>
                <Button size="sm" variant="secondary" onClick={() => { try { downloadCertificate(toPdf(c, sid)); toast.success(t("cert.done", { no: c.number })); } catch { toast.error(t("pl.error")); } }}><FileDown /> {t("cert.download")}</Button>
              </li>))}</ul>
          )}
        </Loaded>
      </Card>
    </>
  );
}
