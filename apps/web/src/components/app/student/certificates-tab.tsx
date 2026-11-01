"use client";
import * as React from "react";
import { FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCertificate } from "@/lib/certificates";
import type { Student } from "@/lib/mock";
import { CERT_LABEL, type StudentRecord } from "@/lib/student-record";
import { formatDateOn } from "@/lib/time";
import { IssueCertificateDialog } from "./issue-certificate-dialog";

/** Issued certificates, reprint from the stored snapshot, and the issue flow. */
export function CertificatesTab({ student, record, by }: { student: Student; record: StudentRecord; by: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificates</CardTitle>
        <Button variant="brand" size="sm" onClick={() => setOpen(true)}><FileText /> Issue certificate</Button>
      </CardHeader>
      {record.certificates.length === 0 ? <EmptyState icon={FileText} title="No certificates issued" text="Transfer, bonafide and character certificates appear here with their numbers." /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Type</TableHead><TableHead>Issued</TableHead><TableHead>Reason</TableHead><TableHead className="w-28"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {record.certificates.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium tabular-nums">{c.number}</TableCell>
                <TableCell>{c.kind === "transfer" ? <Badge tone="danger">{CERT_LABEL[c.kind]}</Badge> : <Badge>{CERT_LABEL[c.kind]}</Badge>}</TableCell>
                <TableCell className="text-sm"><p className="tabular-nums">{formatDateOn(c.issuedOn)}</p><p className="text-xs text-text-tertiary">by {c.issuedBy}</p></TableCell>
                <TableCell className="max-w-56 text-sm text-muted-foreground">{c.reason || "—"}</TableCell>
                <TableCell><div className="flex justify-end"><Button variant="secondary" size="sm" onClick={() => { downloadCertificate(c); toast.success(`${c.number} downloaded`); }}><Printer /> Reprint</Button></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="mt-4 text-xs text-text-tertiary">Numbers are never reused. A reprint is drawn from what was printed the first time, so it is identical.</p>
      <IssueCertificateDialog student={student} open={open} onOpenChange={setOpen} by={by} />
    </Card>
  );
}
