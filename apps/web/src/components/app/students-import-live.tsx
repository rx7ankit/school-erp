"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Can } from "@/components/app/can";
import { NoAccess } from "@/components/app/no-access";
import { DownloadButton, Problem } from "@/components/app/school-bits";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorText } from "@/lib/api/hooks/staff";
import { downloadImportTemplate, useImportCheck, useImportCommit, type ImportCommitOut, type ImportJobOut } from "@/lib/api/hooks/students";

const str = (v: unknown) => (v == null ? "" : String(v));

function Done({ r, onAgain }: { r: ImportCommitOut; onAgain: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-fill"><CheckCircle2 className="size-6 text-success" /></div>
      <div>
        <h2 className="text-xl font-bold">{r.imported} {r.imported === 1 ? "student" : "students"} added</h2>
        {(r.skipped > 0 || r.logins_created > 0) && <p className="mt-1 text-sm text-muted-foreground">
          {r.skipped > 0 && <>{r.skipped} skipped. </>}
          {r.logins_created > 0 && <>{r.logins_created} logins{r.failed ? `, ${r.failed} failed` : ""}.</>}
        </p>}
      </div>
      <div className="flex gap-2.5"><Button asChild variant="brand"><Link href="/students">Students</Link></Button><Button variant="secondary" onClick={onAgain}>Import more</Button></div>
    </Card>
  );
}

/** Excel import on the real API: upload runs a dry run that checks every row, then you commit. */
export function StudentsImportLive() {
  const check = useImportCheck(), commit = useImportCommit();
  const [job, setJob] = React.useState<ImportJobOut | null>(null);
  const [logins, setLogins] = React.useState(false);
  const [sendLogin, setSendLogin] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<ImportCommitOut | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  function onFile(f: File) {
    setErr(null);
    check.mutate({ file: f, create_logins: logins }, { onSuccess: setJob, onError: (e) => setErr(errorText(e)) });
  }
  const reset = () => { setJob(null); setDone(null); setErr(null); check.reset(); commit.reset(); };
  function doCommit(skip: boolean) {
    if (!job) return;
    setErr(null);
    commit.mutate({ jobId: job.id, skip_errors: skip, send_login: sendLogin }, {
      onSuccess: (r) => { toast.success(`${r.imported} students added`); setDone(r); },
      onError: (e) => setErr(errorText(e)),
    });
  }
  const bad = job?.rows.filter((r) => !r.ok) ?? [];
  const showRows = job ? [...bad, ...job.rows.filter((r) => r.ok)] : [];

  return (
    <Can access="academic.manage" fallback={<NoAccess need="the Academic permission" />}>
      <PageHeader title="Import"
        actions={<><DownloadButton variant="secondary" label="Template" run={downloadImportTemplate} /><Button asChild variant="ghost"><Link href="/students"><ArrowLeft /> Back</Link></Button></>} />
      {done ? <Done r={done} onAgain={reset} /> : !job ? (
        <Card className="flex flex-col items-center gap-5 py-14 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-fill"><FileSpreadsheet className="size-6 text-muted-foreground" /></div>
          <div className="flex items-center gap-3"><Checkbox id="logins" checked={logins} onCheckedChange={(c) => setLogins(c === true)} /><Label htmlFor="logins">Create parent logins</Label></div>
          <input ref={input} type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Excel file" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <Button variant="brand" loading={check.isPending} onClick={() => input.current?.click()}>{!check.isPending && <Upload />} Choose file</Button>
          <Problem text={err} />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div><CardTitle className="break-all">{job.file_name}</CardTitle><CardDescription>{job.total_rows} rows</CardDescription></div>
            <div className="flex gap-2"><Badge tone="success">{job.ok_rows} ready</Badge>{job.error_rows > 0 && <Badge tone="danger">{job.error_rows} errors</Badge>}</div>
          </CardHeader>
          <Table className="min-w-[640px]">
            <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Guardian</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {showRows.map((r) => (
                <TableRow key={r.row_no}>
                  <TableCell className="tabular-nums text-text-tertiary">{r.row_no}</TableCell>
                  <TableCell>{[str(r.data.first_name), str(r.data.last_name)].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell>{str(r.data.class) || "—"}</TableCell>
                  <TableCell>{str(r.data.guardian_name) || "—"}<p className="text-xs text-text-tertiary">{str(r.data.guardian_phone)}</p></TableCell>
                  <TableCell>{r.ok
                    ? <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="size-4" />Ready</span>
                    : <span className="flex items-start gap-1.5 text-danger"><TriangleAlert className="mt-0.5 size-4 shrink-0" />{r.error}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Checkbox id="send" checked={sendLogin} onCheckedChange={(c) => setSendLogin(c === true)} /><Label htmlFor="send">Email logins</Label></div>
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button variant="secondary" onClick={reset}>Change file</Button>
              {job.error_rows > 0 && job.ok_rows > 0 && <Button variant="secondary" loading={commit.isPending && commit.variables?.skip_errors} onClick={() => doCommit(true)}>Add {job.ok_rows} ready</Button>}
              <Button variant="brand" disabled={job.total_rows === 0 || job.error_rows > 0} loading={commit.isPending && !commit.variables?.skip_errors} onClick={() => doCommit(false)}>Add {job.total_rows} {job.total_rows === 1 ? "student" : "students"}</Button>
            </div>
          </div>
          <div className="mt-3 flex flex-col items-end gap-1"><Problem text={err} />{job.error_rows > 0 &&}</div>
        </Card>
      )}
    </Can>
  );
}
