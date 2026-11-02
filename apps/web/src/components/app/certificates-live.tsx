"use client";
import * as React from "react";
import { FileText, Lock, Printer, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCancelCertificate, useCertificates, useIssueCertificate, useReissueCertificate, type CertificateKind, type CertificateOut } from "@/lib/api/hooks/certificates";
import { errorText } from "@/lib/api/hooks/staff";
import { downloadCertificate } from "@/lib/certificates";
import { hasAccess } from "@/lib/permissions";
import { CONDUCT, type Certificate } from "@/lib/student-record";
import { formatDateOn, formatIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const LABEL: Record<CertificateKind, string> = { transfer: "Transfer certificate", bonafide: "Bonafide certificate", character: "Character certificate" };
const KINDS: CertificateKind[] = ["transfer", "bonafide", "character"];

/** The API certificate drawn by the same PDF the demo uses. The PDF only reads what the API froze in `snapshot`. */
function toPdf(c: CertificateOut): Certificate {
  const s = c.snapshot as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: c.id, studentId: c.student_id, kind: c.kind as CertificateKind, number: c.number, issuedOn: c.issued_on, issuedBy: c.issued_by_name ?? "", reason: c.reason ?? "",
    snapshot: {
      school: s.school?.name ?? "", city: s.school?.city ?? "", academicYear: s.academic_year ?? "", studentName: s.student?.name ?? c.student_name,
      gender: /^m/i.test(s.student?.gender ?? "") ? "M" : "F", guardian: s.guardian?.name ?? "", dob: s.student?.dob ?? c.issued_on,
      className: s.class ?? "", scholarNo: s.student?.scholar_no ?? c.scholar_no, admittedOn: s.student?.admitted_on ?? c.issued_on,
      leftOn: s.left_on ?? undefined, leavingReason: c.kind === "transfer" ? s.reason ?? undefined : undefined, conduct: s.conduct ?? undefined, purpose: s.purpose ?? undefined,
    },
  };
}

type Dialogs = { kind: "issue" } | { kind: "cancel" | "reissue"; cert: CertificateOut } | null;

/**
 * Certificates of one student on the real API: list, issue, cancel, reissue, reprint.
 * Mount it on the student page in live mode. Only the academic team can use it (the API enforces this too).
 *   <CertificatesLive studentId={id} studentName={name} status={student.status} />
 */
export function CertificatesLive({ studentId, studentName, status }: { studentId: string; studentName: string; status?: string }) {
  const { user } = useSession();
  const allowed = hasAccess(user, "academic.manage");
  const q = useCertificates(allowed ? studentId : "");
  const [dlg, setDlg] = React.useState<Dialogs>(null);
  if (!allowed) return <Card><CardHeader><CardTitle>Certificates</CardTitle></CardHeader><EmptyState icon={Lock} title="Academic team only" text="Certificates are issued by people with Academic access." /></Card>;
  const items = q.data?.items ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificates</CardTitle>
        <Button variant="brand" size="sm" onClick={() => setDlg({ kind: "issue" })}><FileText /> Issue certificate</Button>
      </CardHeader>
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : items.length === 0 ? (
        <EmptyState icon={FileText} title="No certificates issued" text="Transfer, bonafide and character certificates appear here with their numbers." />
      ) : (
        <Table className="min-w-[720px]">
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Type</TableHead><TableHead>Issued</TableHead><TableHead>Reason</TableHead><TableHead className="w-64"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>{items.map((c) => {
            const cancelled = c.status === "cancelled";
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium tabular-nums">{c.number}{cancelled && <span className="ml-2"><Badge tone="danger">Cancelled</Badge></span>}</TableCell>
                <TableCell>{c.kind === "transfer" ? <Badge tone="danger">{LABEL[c.kind]}</Badge> : <Badge>{LABEL[c.kind as CertificateKind] ?? c.kind}</Badge>}</TableCell>
                <TableCell className="text-sm"><p className="tabular-nums">{formatDateOn(c.issued_on)}</p><p className="text-xs text-text-tertiary">by {c.issued_by_name ?? "—"}</p></TableCell>
                <TableCell className="max-w-56 text-sm text-muted-foreground">{c.reason || "—"}{cancelled && <p className="mt-1 text-xs text-danger">Cancelled{c.cancelled_at ? ` ${formatIST(c.cancelled_at, "short")}` : ""}: {c.cancel_reason}</p>}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { downloadCertificate(toPdf(c)); toast.success(`${c.number} downloaded`); }}><Printer /> Reprint</Button>
                    {!cancelled && <Button variant="secondary" size="sm" onClick={() => setDlg({ kind: "reissue", cert: c })}><RefreshCw /> Reissue</Button>}
                    {!cancelled && <Button variant="secondary" size="sm" onClick={() => setDlg({ kind: "cancel", cert: c })}><XCircle /> Cancel</Button>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table>
      )}
      <p className="mt-4 text-xs text-text-tertiary">Numbers are never reused. A reprint is drawn from what was printed the first time, so it is identical.</p>
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          {dlg?.kind === "issue" && <IssueForm studentId={studentId} studentName={studentName} status={status} onDone={() => setDlg(null)} />}
          {dlg?.kind === "cancel" && <CancelForm cert={dlg.cert} onDone={() => setDlg(null)} />}
          {dlg?.kind === "reissue" && <ReissueForm cert={dlg.cert} onDone={() => setDlg(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const Problem = ({ text }: { text: string | null }) => (text ? <p role="alert" className="text-sm text-danger">{text}</p> : null);
const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

function IssueForm({ studentId, studentName, status, onDone }: { studentId: string; studentName: string; status?: string; onDone: () => void }) {
  const today = useTodayIST();
  const issue = useIssueCertificate();
  const left = !!status && status !== "active";
  const [kind, setKind] = React.useState<CertificateKind>(left ? "transfer" : "bonafide");
  const [err, setErr] = React.useState<string | null>(null);
  const tc = kind === "transfer";
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr(null);
    issue.mutate({
      student_id: studentId, kind, reason: clean(f.get("reason")), purpose: tc ? null : clean(f.get("purpose")), conduct: kind === "bonafide" ? null : clean(f.get("conduct")),
      remarks: clean(f.get("remarks")), issued_on: clean(f.get("issued_on")), left_on: tc && !left ? clean(f.get("left_on")) : null,
    }, {
      onSuccess: (c) => { downloadCertificate(toPdf(c)); onDone(); toast.success(`${c.number} issued`); },
      onError: (x) => setErr(errorText(x)),
    });
  }
  return (
    <>
      <DialogHeader><DialogTitle>Issue certificate</DialogTitle><DialogDescription>For {studentName}. The number is used up once issued and cannot be reused or deleted.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Certificate" htmlFor="c-kind">
          <NativeSelect id="c-kind" value={kind} onChange={(e) => { setKind(e.target.value as CertificateKind); setErr(null); }}>{KINDS.map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}</NativeSelect>
          {tc && <p className="text-xs text-text-tertiary">Issuing a transfer certificate marks {studentName} as TC issued.</p>}
        </Field>
        {tc ? (
          <>
            <Field label="Reason for leaving" htmlFor="c-reason"><Input id="c-reason" name="reason" maxLength={500} placeholder="Family moved, changed school, ..." /></Field>
            {!left && <Field label="Leaving date" htmlFor="c-left" hint="Needed because the student is still enrolled."><Input id="c-left" name="left_on" type="date" required max={today || undefined} /></Field>}
          </>
        ) : <Field label="Purpose" htmlFor="c-purpose"><Input id="c-purpose" name="purpose" maxLength={200} placeholder="Bank account, scholarship, passport, ..." /></Field>}
        {kind !== "bonafide" && <Field label="Conduct" htmlFor="c-conduct"><NativeSelect id="c-conduct" name="conduct" defaultValue="Good">{CONDUCT.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date on certificate" htmlFor="c-on" hint="Leave empty for today."><Input id="c-on" name="issued_on" type="date" max={today || undefined} /></Field>
          <Field label="Remarks (optional)" htmlFor="c-remarks"><Input id="c-remarks" name="remarks" maxLength={500} /></Field>
        </div>
        <Problem text={err} />
        <DialogFooter><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" variant="brand" loading={issue.isPending}>Issue and download</Button></DialogFooter>
      </form>
    </>
  );
}

function CancelForm({ cert, onDone }: { cert: CertificateOut; onDone: () => void }) {
  const cancel = useCancelCertificate();
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <>
      <DialogHeader><DialogTitle>Cancel {cert.number}?</DialogTitle><DialogDescription>The certificate stays in the list as cancelled and its number is not reused. Parents no longer see it.</DialogDescription></DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); setErr(null); cancel.mutate({ id: cert.id, reason: reason.trim() }, { onSuccess: () => { onDone(); toast.success(`${cert.number} cancelled`); }, onError: (x) => setErr(errorText(x)) }); }}>
        <Field label="Reason" htmlFor="c-cancel"><Textarea id="c-cancel" required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being cancelled?" /></Field>
        <Problem text={err} />
        <DialogFooter><Button type="button" variant="secondary" onClick={onDone}>Keep it</Button><Button type="submit" variant="destructive" loading={cancel.isPending}>Cancel certificate</Button></DialogFooter>
      </form>
    </>
  );
}

function ReissueForm({ cert, onDone }: { cert: CertificateOut; onDone: () => void }) {
  const reissue = useReissueCertificate();
  const [err, setErr] = React.useState<string | null>(null);
  const snap = cert.snapshot as Record<string, string | undefined>;
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr(null);
    reissue.mutate({ id: cert.id, reason: String(f.get("why")).trim(), conduct: cert.kind === "bonafide" ? null : clean(f.get("conduct")), purpose: cert.kind === "transfer" ? null : clean(f.get("purpose")), remarks: clean(f.get("remarks")), issued_on: clean(f.get("issued_on")) }, {
      onSuccess: (c) => { downloadCertificate(toPdf(c)); onDone(); toast.success(`${c.number} issued`, { description: `${cert.number} was cancelled.` }); },
      onError: (x) => setErr(errorText(x)),
    });
  }
  return (
    <>
      <DialogHeader><DialogTitle>Reissue {cert.number}</DialogTitle><DialogDescription>Cancels this certificate and issues a new one with a new number, for example after a correction.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Why is it being reissued?" htmlFor="r-why"><Textarea id="r-why" name="why" required minLength={3} maxLength={500} placeholder="Name spelling corrected, ..." /></Field>
        {cert.kind !== "bonafide" && <Field label="Conduct" htmlFor="r-conduct"><NativeSelect id="r-conduct" name="conduct" defaultValue={snap.conduct ?? "Good"}>{CONDUCT.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>}
        {cert.kind !== "transfer" && <Field label="Purpose" htmlFor="r-purpose"><Input id="r-purpose" name="purpose" maxLength={200} defaultValue={snap.purpose ?? ""} /></Field>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date on certificate" htmlFor="r-on" hint="Leave empty for today."><Input id="r-on" name="issued_on" type="date" /></Field>
          <Field label="Remarks (optional)" htmlFor="r-remarks"><Input id="r-remarks" name="remarks" maxLength={500} defaultValue={snap.remarks ?? ""} /></Field>
        </div>
        <Problem text={err} />
        <DialogFooter><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" variant="brand" loading={reissue.isPending}>Reissue and download</Button></DialogFooter>
      </form>
    </>
  );
}
