"use client";
import * as React from "react";
import { FileUp, Play } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { ExcelButton, Problem } from "@/components/app/bits-a3";
import { StudentPicker } from "@/components/app/fees-setup-live";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClasses } from "@/lib/api/hooks/academic";
import {
  FREQUENCY_LABEL, useApplyLateFees, useFeeSettings, useGenerateInvoices, useLateRules, useOpeningBalances, useOpeningImportCheck, useOpeningImportCommit, useRuns, useSaveFeeSettings,
  useSetLateRule, useSetOpeningBalance, type FeeFrequency, type OpeningImport, type StudentHit,
} from "@/lib/api/hooks/fees";
import { inr, parseRupees, rupeesText } from "@/lib/money";
import { formatDateOn, formatIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const FREQS = Object.keys(FREQUENCY_LABEL) as FeeFrequency[];
const intIn = (s: string, max: number) => (/^\d{1,4}$/.test(s.trim()) && Number(s) <= max ? Number(s) : null);

/* ------------------------------------------------------------------ late fee */
export function LateFeeTab() {
  const rules = useLateRules(), save = useSetLateRule(), apply = useApplyLateFees();
  const active = rules.data?.find((r) => r.is_active);
  const [grace, setGrace] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [per, setPer] = React.useState<"once" | "day">("once");
  const [cap, setCap] = React.useState("");
  const [err, setErr] = React.useState<unknown>(null);
  const loaded = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!rules.data || loaded.current === (active?.id ?? "none")) return;
    loaded.current = active?.id ?? "none";
    setGrace(String(active?.grace_days ?? 0)); setAmount(active ? rupeesText(active.amount_paise) : ""); setPer((active?.per as "once" | "day") ?? "once"); setCap(active?.max_paise ? rupeesText(active.max_paise) : "");
  }, [rules.data, active]);
  if (rules.isError) return <ErrorBlock error={rules.error} onRetry={() => rules.refetch()} />;
  if (!rules.data) return <LoadingBlock label="Loading" />;
  const g = intIn(grace, 365), a = parseRupees(amount), c = cap.trim() ? parseRupees(cap) : null;
  const invalid = g === null || a === null || a <= 0 || (cap.trim() !== "" && (c === null || c <= 0));
  return (
    <Card className="flex flex-col gap-5">
      <CardHeader className="mb-0"><div><CardTitle>Late fee</CardTitle></div>
        {active ? <Badge tone="success">Active</Badge> : <Badge>Off</Badge>}</CardHeader>
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => {
        e.preventDefault(); setErr(null);
        if (invalid || g === null || a === null) return;
        save.mutate({ grace_days: g, amount_paise: a, per, max_paise: c }, { onSuccess: () => { loaded.current = null; toast.success("Saved"); }, onError: setErr });
      }}>
        <Field label="Grace days" htmlFor="lg"><Input id="lg" inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value)} /></Field>
        <Field label="Amount (₹)" htmlFor="la"><Input id="la" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Charged" htmlFor="lp"><NativeSelect id="lp" value={per} onChange={(e) => setPer(e.target.value as "once" | "day")}><option value="once">Once</option><option value="day">Daily</option></NativeSelect></Field>
        <Field label="Cap (₹)" htmlFor="lc"><Input id="lc" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} /></Field>
        <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" variant="brand" loading={save.isPending} disabled={invalid}>Save</Button></div>
      </form>
      <Problem error={err} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <span />
        <Button variant="secondary" loading={apply.isPending} disabled={!active} onClick={() => apply.mutate({}, { onSuccess: (r) => toast.success(r.updated ? `Added to ${r.updated}` : "Nothing to add", { description: r.updated ? `Total ${inr(r.total_late_paise)}` : undefined }), onError: (e) => toast.error(e.message) })}>Apply now</Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ settings */
export function SettingsTab() {
  const s = useFeeSettings(), save = useSaveFeeSettings();
  const [on, setOn] = React.useState(false);
  const [days, setDays] = React.useState("15");
  const [err, setErr] = React.useState<unknown>(null);
  const seeded = React.useRef(false);
  React.useEffect(() => { if (s.data && !seeded.current) { seeded.current = true; setOn(s.data.auto_first_invoice); setDays(String(s.data.first_invoice_due_days)); } }, [s.data]);
  if (s.isError) return <ErrorBlock error={s.error} onRetry={() => s.refetch()} />;
  if (!s.data) return <LoadingBlock label="Loading" />;
  const d = intIn(days, 180);
  return (
    <Card className="flex flex-col gap-5">
      <CardHeader className="mb-0"><div><CardTitle>Settings</CardTitle></div></CardHeader>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-fill px-4 py-3">
        <Label htmlFor="auto">Auto first invoice</Label>
        <Switch id="auto" checked={on} onCheckedChange={setOn} />
      </div>
      <div className="max-w-xs"><Field label="Days to pay" htmlFor="fd"><Input id="fd" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} aria-invalid={d === null} /></Field></div>
      <Problem error={err} />
      <div><Button variant="brand" loading={save.isPending} disabled={d === null} onClick={() => { setErr(null); if (d !== null) save.mutate({ auto_first_invoice: on, first_invoice_due_days: d }, { onSuccess: () => toast.success("Settings saved"), onError: setErr }); }}>Save</Button></div>
    </Card>
  );
}

/* ------------------------------------------------------------------ invoice runs */
export function GenerateTab() {
  const today = useTodayIST();
  const classes = useClasses(), runs = useRuns(), gen = useGenerateInvoices();
  const [period, setPeriod] = React.useState("");
  const [due, setDue] = React.useState("");
  const [freqs, setFreqs] = React.useState<FeeFrequency[]>(FREQS);
  const [picked, setPicked] = React.useState<string[] | null>(null);
  const [carry, setCarry] = React.useState(true);
  const [err, setErr] = React.useState<unknown>(null);
  const toggle = <T,>(arr: T[], v: T, on: boolean) => (on ? [...arr, v] : arr.filter((x) => x !== v));
  const ok = period.trim() && due && freqs.length && (picked === null || picked.length);
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5">
        <CardHeader className="mb-0"><div><CardTitle>Generate</CardTitle></div></CardHeader>
        <form className="flex flex-col gap-5" onSubmit={(e) => {
          e.preventDefault(); setErr(null);
          gen.mutate({ period_label: period.trim(), due_on: due, frequencies: freqs, class_ids: picked, carry_forward: carry }, {
            onSuccess: (r) => toast.success(`${r.invoices_created} created`, { description: [r.skipped_existing ? `${r.skipped_existing} existed` : "", r.skipped_no_fees ? `${r.skipped_no_fees} no fees` : ""].filter(Boolean).join(". ") || undefined }),
            onError: setErr,
          });
        }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Period" htmlFor="gp"><Input id="gp" value={period} onChange={(e) => setPeriod(e.target.value)} maxLength={60} /></Field>
            <Field label="Due on" htmlFor="gd"><Input id="gd" type="date" value={due} min={today || undefined} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
          <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-medium">Frequency</legend>
            <div className="flex flex-wrap gap-2">{FREQS.map((f) => (
              <label key={f} className="flex cursor-pointer items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm"><Checkbox checked={freqs.includes(f)} onCheckedChange={(v) => setFreqs((a) => toggle(a, f, v === true))} />{FREQUENCY_LABEL[f]}</label>
            ))}</div>
          </fieldset>
          <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-medium">Classes</legend>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm"><Checkbox checked={picked === null} onCheckedChange={(v) => setPicked(v === true ? null : [])} />All classes</label>
            {picked !== null && <div className="flex flex-wrap gap-2">{(classes.data?.items ?? []).map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm"><Checkbox checked={picked.includes(c.id)} onCheckedChange={(v) => setPicked((a) => toggle(a ?? [], c.id, v === true))} />Class {c.grade}-{c.section}</label>
            ))}</div>}
          </fieldset>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm"><Checkbox checked={carry} onCheckedChange={(v) => setCarry(v === true)} />Carry forward balance</label>
          <Problem error={err} />
          <div><Button type="submit" variant="brand" loading={gen.isPending} disabled={!ok}><Play /> Generate</Button></div>
        </form>
      </Card>
      <Card className="flex flex-col gap-4">
        <CardHeader className="mb-0"><div><CardTitle>Runs</CardTitle></div></CardHeader>
        {runs.isError ? <ErrorBlock error={runs.error} onRetry={() => runs.refetch()} /> : !runs.data ? <LoadingBlock label="Loading" /> : (
          <Table className="min-w-[640px]">
            <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Created</TableHead><TableHead className="text-right">Existed</TableHead><TableHead className="text-right">No fees</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
            <TableBody>
              {runs.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.period_label}</TableCell><TableCell>{formatDateOn(r.due_on)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.invoices_created}</TableCell><TableCell className="text-right tabular-nums">{r.skipped_existing}</TableCell><TableCell className="text-right tabular-nums">{r.skipped_no_fees}</TableCell>
                  <TableCell className="text-muted-foreground">{r.created_by_name ?? "—"}<p className="text-xs text-text-tertiary">{formatIST(r.created_at)}</p></TableCell>
                </TableRow>
              ))}
              {runs.data.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No runs.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ opening balances */
export function OpeningTab() {
  const list = useOpeningBalances(), set = useSetOpeningBalance();
  const today = useTodayIST();
  const [student, setStudent] = React.useState<StudentHit | null>(null);
  const [amount, setAmount] = React.useState("");
  const [asOf, setAsOf] = React.useState("");
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<unknown>(null);
  const paise = parseRupees(amount);
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <CardHeader className="mb-0"><div><CardTitle>Opening</CardTitle></div></CardHeader>
        <StudentPicker value={student} onChange={setStudent} />
        {student && (
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_170px_1fr_auto]" onSubmit={(e) => {
            e.preventDefault(); setErr(null);
            if (paise === null || !asOf) return;
            set.mutate({ student_id: student.id, amount_paise: paise, as_of_on: asOf, note: note.trim() || null }, { onSuccess: () => { toast.success("Saved"); setStudent(null); setAmount(""); setNote(""); }, onError: setErr });
          }}>
            <Input aria-label="Amount owed in rupees" inputMode="decimal" placeholder="Owed (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input aria-label="As of date" type="date" value={asOf} max={today || undefined} onChange={(e) => setAsOf(e.target.value)} />
            <Input aria-label="Note" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            <Button type="submit" variant="brand" loading={set.isPending} disabled={paise === null || paise <= 0 || !asOf}>Save</Button>
          </form>
        )}
        <Problem error={err} />
        {list.isError ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : !list.data ? <LoadingBlock label="Loading" /> : (
          <Table className="min-w-[640px]">
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead className="text-right">Owed</TableHead><TableHead>As of</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell><p className="font-medium">{b.student_name}</p><p className="text-xs text-text-tertiary">{b.scholar_no}{b.note ? ` · ${b.note}` : ""}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{inr(b.amount_paise)}</TableCell><TableCell>{formatDateOn(b.as_of_on)}</TableCell>
                  <TableCell>{b.locked ? <Badge>Invoiced</Badge> : <Badge tone="warning">Pending</Badge>}</TableCell>
                </TableRow>
              ))}
              {list.data.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No opening balances.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>
      <OpeningImport />
    </div>
  );
}

function OpeningImport() {
  const check = useOpeningImportCheck(), commit = useOpeningImportCommit();
  const [job, setJob] = React.useState<OpeningImport | null>(null);
  const [skip, setSkip] = React.useState(false);
  const [err, setErr] = React.useState<unknown>(null);
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0"><div><CardTitle>Import</CardTitle></div>
        <ExcelButton path="/fees/opening-balances/template" fallbackName="opening-balances-template.xlsx" label="Template" /></CardHeader>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".xlsx" className="sr-only" aria-label="Excel file" onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          setErr(null); setJob(null);
          check.mutate(f, { onSuccess: setJob, onError: setErr });
        }} />
        <Button variant="secondary" loading={check.isPending} onClick={() => input.current?.click()}>{!check.isPending && <FileUp />} Choose file</Button>
      </div>
      <Problem error={err} />
      {job && (
        <div className="flex flex-col gap-3">
          <p className="text-sm"><b>{job.file_name}</b>: {job.ok_rows} ok, {job.error_rows} errors</p>
          {job.status === "imported" ? <Badge tone="success">Imported</Badge> : (
            <>
              {job.error_rows > 0 && <div className="flex items-center gap-2"><Checkbox id="skip" checked={skip} onCheckedChange={(v) => setSkip(v === true)} /><Label htmlFor="skip">Skip errors</Label></div>}
              <div><Button variant="brand" loading={commit.isPending} disabled={job.ok_rows === 0 || (job.error_rows > 0 && !skip)} onClick={() => commit.mutate({ id: job.id, skip_errors: skip }, { onSuccess: (r) => { toast.success(`${r.imported} imported`, { description: r.skipped ? `${r.skipped} skipped` : undefined }); setJob(null); }, onError: setErr })}>Import {job.ok_rows}</Button></div>
            </>
          )}
          {job.error_rows > 0 && (
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {job.rows.filter((r) => !r.ok).map((r) => <li key={r.row_no} className="rounded-xl bg-fill px-4 py-2 text-sm"><span className="tabular-nums text-text-tertiary">Row {r.row_no}</span> <span className="text-danger">{r.error}</span></li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
