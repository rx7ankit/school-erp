"use client";
import * as React from "react";
import Link from "next/link";
import { readSheet } from "read-excel-file/browser";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { Can } from "@/components/app/can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CLASSES, className } from "@/lib/mock";

const COLUMNS = ["Name", "Class", "Date of birth", "Guardian", "Mobile"] as const;
type Row = { n: number; cells: string[]; error?: string };

function validate(cells: string[], n: number): Row {
  const [name, cls, dob, guardian, mobile] = cells;
  const valid = new Set(CLASSES.map((c) => className(c.id)));
  let error: string | undefined;
  if (!name) error = "Name is missing";
  else if (!valid.has(cls)) error = `Class "${cls}" does not exist`;
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) error = "Date of birth should be YYYY-MM-DD";
  else if (!guardian) error = "Guardian is missing";
  else if (!/^\d{10}$/.test(mobile.replace(/\s/g, ""))) error = "Mobile should be 10 digits";
  return { n, cells, error };
}

export default function ImportPage() {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [file, setFile] = React.useState("");
  const input = React.useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    setFile(f.name);
    try {
      const data = await readSheet(f);
      const body = data.slice(1).filter((r) => r.some(Boolean));
      setRows(body.map((r, i) => validate(COLUMNS.map((_, c) => {
        const v = r[c];
        return v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "" : String(v).trim();
      }), i + 2)));
    } catch {
      toast.error("Could not read this file. Use the .xlsx template.");
    }
  }
  function sample() {
    setFile("sample-students.xlsx");
    setRows([
      ["Aryan Soni", "6-A", "2014-03-12", "Mahesh Soni", "90000 40001"],
      ["Bhavya Tiwari", "8-B", "2012-07-02", "Sandeep Tiwari", "90000 40002"],
      ["Chirag Pathak", "9-A", "2011-13-45", "Lalit Pathak", "90000 40003"],
      ["Divya Kushwaha", "7-A", "2013-01-19", "Ramesh Kushwaha", "900004"],
    ].map((c, i) => validate(c, i + 2)));
  }
  const ok = rows?.filter((r) => !r.error).length ?? 0;
  const bad = (rows?.length ?? 0) - ok;

  return (
    <Can access="academic.manage" fallback={<NoAccess need="the Academic permission" />}>
      <PageHeader eyebrow="Students" title="Import from Excel." dim="Check first, then add."
        actions={<Button asChild variant="ghost"><Link href="/students"><ArrowLeft /> Back</Link></Button>} />

      {!rows ? (
        <Card className="flex flex-col items-center gap-5 py-14 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-fill"><FileSpreadsheet className="size-6 text-muted-foreground" /></div>
          <div>
            <h2 className="text-xl font-bold">Upload your student sheet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Columns in order: {COLUMNS.join(", ")}. The first row is the heading. Dates look like 2013-08-24.</p>
          </div>
          <input ref={input} type="file" accept=".xlsx" className="sr-only" aria-label="Excel file" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button variant="brand" onClick={() => input.current?.click()}><Upload /> Choose .xlsx file</Button>
            <Button variant="secondary" onClick={sample}>Try a sample</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div><CardTitle>{file}</CardTitle><CardDescription>{rows.length} rows checked</CardDescription></div>
            <div className="flex gap-2"><Badge tone="success">{ok} ready</Badge>{bad > 0 && <Badge tone="danger">{bad} need fixing</Badge>}</div>
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Row</TableHead>{COLUMNS.map((c) => <TableHead key={c}>{c}</TableHead>)}<TableHead>Check</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.n}>
                  <TableCell className="tabular-nums text-text-tertiary">{r.n}</TableCell>
                  {r.cells.map((c, i) => <TableCell key={i}>{c || "—"}</TableCell>)}
                  <TableCell>{r.error
                    ? <span className="flex items-center gap-1.5 text-danger"><TriangleAlert className="size-4 shrink-0" />{r.error}</span>
                    : <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="size-4" />Ready</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setRows(null)}>Choose another file</Button>
            <Button variant="brand" disabled={ok === 0} onClick={() => { toast.success(`${ok} students added`); setRows(null); }}>
              Add {ok} {ok === 1 ? "student" : "students"}
            </Button>
          </div>
          {bad > 0 && <p className="mt-3 text-right text-xs text-text-tertiary">Rows with problems are skipped. Fix them in the sheet and import again.</p>}
        </Card>
      )}
    </Can>
  );
}
