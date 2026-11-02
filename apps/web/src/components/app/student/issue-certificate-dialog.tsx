"use client";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { downloadCertificate } from "@/lib/certificates";
import type { Student } from "@/lib/mock";
import { CERT_LABEL, CONDUCT, canIssue, issueCertificate, nextCertNumber, type CertKind } from "@/lib/student-record";
import { usePending } from "@/lib/use-pending";
import { FieldError } from "./field-error";

const KINDS: CertKind[] = ["transfer", "bonafide", "character"];

/** Two steps: fill in, then confirm. Issuing a TC marks the student as TC issued. */
export function IssueCertificateDialog({ student, open, onOpenChange, by }: { student: Student; open: boolean; onOpenChange: (o: boolean) => void; by: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent><IssueBody student={student} onOpenChange={onOpenChange} by={by} /></DialogContent>
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so its state starts fresh every time. */
function IssueBody({ student, onOpenChange, by }: { student: Student; onOpenChange: (o: boolean) => void; by: string }) {
  const firstAllowed = KINDS.find((k) => !canIssue(student, k)) ?? "bonafide";
  const [kind, setKind] = React.useState<CertKind>(firstAllowed);
  const [reason, setReason] = React.useState(student.status !== "active" ? student.leavingReason ?? "" : "");
  const [conduct, setConduct] = React.useState<string>("Good");
  const [step, setStep] = React.useState<"form" | "confirm">("form");
  const [error, setError] = React.useState("");
  const { run, is } = usePending();
  const blocked = canIssue(student, kind);
  const isTc = kind === "transfer";

  function review(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) return;
    if (!reason.trim()) return setError(isTc ? "Enter the reason for leaving." : "Enter what the certificate is for.");
    setError(""); setStep("confirm");
  }
  function issue() {
    run("issue", () => {
      const res = issueCertificate(student, { kind, reason: reason.trim(), conduct, issuedBy: by });
      if (!res.ok) { toast.error(res.error); setStep("form"); return; }
      downloadCertificate(res.certificate);
      onOpenChange(false);
      toast.success(`${res.certificate.number} issued`);
    });
  }

  return (
    <>
        {step === "form" ? (
          <>
            <DialogHeader><DialogTitle>Issue certificate</DialogTitle><DialogDescription>{student.name} · {nextCertNumber(kind)}</DialogDescription></DialogHeader>
            <form onSubmit={review} className="flex flex-col gap-4">
              <Field label="Certificate" htmlFor="ckind">
                <NativeSelect id="ckind" value={kind} onChange={(e) => { setKind(e.target.value as CertKind); setError(""); }}>
                  {KINDS.map((k) => <option key={k} value={k}>{CERT_LABEL[k]}</option>)}
                </NativeSelect>
                {blocked && <p role="alert" className="text-xs text-danger">{blocked}</p>}
              </Field>
              <Field label={isTc ? "Reason" : "Purpose"} htmlFor="creason">
                <Input id="creason" value={reason} disabled={!!blocked}  aria-describedby="creason-err" aria-invalid={error ? true : undefined} onChange={(e) => setReason(e.target.value)} />
                <FieldError id="creason-err" message={error} />
              </Field>
              {kind !== "bonafide" && (
                <Field label="Conduct" htmlFor="cconduct"><NativeSelect id="cconduct" disabled={!!blocked} value={conduct} onChange={(e) => setConduct(e.target.value)}>{CONDUCT.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
              )}
              <DialogFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="brand" disabled={!!blocked}>Review</Button></DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>Issue {nextCertNumber(kind)}?</DialogTitle>
              <DialogDescription>
                Number cannot be reused.
              </DialogDescription></DialogHeader>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Type</dt><dd className="font-medium">{CERT_LABEL[kind]}</dd>
              <dt className="text-muted-foreground">Student</dt><dd className="font-medium">{student.name}</dd>
              <dt className="text-muted-foreground">{isTc ? "Reason" : "Purpose"}</dt><dd className="font-medium">{reason}</dd>
              {kind !== "bonafide" && <><dt className="text-muted-foreground">Conduct</dt><dd className="font-medium">{conduct}</dd></>}
            </dl>
            <DialogFooter><Button variant="secondary" onClick={() => setStep("form")}>Back</Button><Button variant="brand" loading={is("issue")} onClick={issue}>Issue</Button></DialogFooter>
          </>
        )}
    </>
  );
}
