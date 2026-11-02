"use client";
import * as React from "react";
import { Eye, Lock, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOC_LABEL, addDocument, removeDocument, type DocKind, type StudentDocument, type StudentRecord } from "@/lib/student-record";
import { formatIST } from "@/lib/time";
import { usePending } from "@/lib/use-pending";

const MAX = 5 * 1024 * 1024;
export const fileSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Documents are visible only to academic managers and admin. Stored in memory in this demo. */
export function DocumentsTab({ studentId, record, by }: { studentId: string; record: StudentRecord; by: string }) {
  const [kind, setKind] = React.useState<DocKind>("birth_certificate");
  const [viewing, setViewing] = React.useState<StudentDocument | null>(null);
  const [removing, setRemoving] = React.useState<StudentDocument | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const { run, is } = usePending();

  function onFile(f: File) {
    if (f.size > MAX) return toast.error("Max 5 MB.");
    run("up", () => { addDocument(studentId, { kind, fileName: f.name, size: f.size, uploadedBy: by }); toast.success(`${f.name} uploaded`); });
  }
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56"><Field label="Type" htmlFor="dkind">
            <NativeSelect id="dkind" value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
              {(Object.keys(DOC_LABEL) as DocKind[]).map((k) => <option key={k} value={k}>{DOC_LABEL[k]}</option>)}
            </NativeSelect></Field></div>
          <input ref={input} type="file" accept=".pdf,image/*" className="sr-only" aria-label="Document file" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <Button variant="brand" loading={is("up")} onClick={() => input.current?.click()}><Upload /> Choose file</Button>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        {record.documents.length === 0 ? <EmptyState icon={Lock} title="No documents" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>File</TableHead><TableHead>Uploaded</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {record.documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{DOC_LABEL[d.kind]}</TableCell>
                  <TableCell><p className="break-all">{d.fileName}</p><p className="text-xs text-text-tertiary">{fileSize(d.size)}</p></TableCell>
                  <TableCell className="text-sm"><p>{formatIST(d.uploadedAt)}</p><p className="text-xs text-text-tertiary">by {d.uploadedBy}</p></TableCell>
                  <TableCell><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label={`View details of ${d.fileName}`} onClick={() => setViewing(d)}><Eye /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${d.fileName}`} onClick={() => setRemoving(d)}><Trash2 /></Button>
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{viewing && DOC_LABEL[viewing.kind]}</DialogTitle><DialogDescription className="sr-only">Document details</DialogDescription></DialogHeader>
          {viewing && <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
            {[["File", viewing.fileName], ["Size", fileSize(viewing.size)], ["Uploaded", `${formatIST(viewing.uploadedAt)} IST`], ["By", viewing.uploadedBy]].map(([k, v]) => (
              <React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-all font-medium">{v}</dd></React.Fragment>))}
          </dl>}
          <DialogFooter><Button variant="secondary" onClick={() => setViewing(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove document?</DialogTitle><DialogDescription>{removing?.fileName}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" loading={is("rm")} onClick={() => run("rm", () => { if (removing) removeDocument(studentId, removing.id); setRemoving(null); toast.success("Document removed"); })}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
