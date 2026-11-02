"use client";
import * as React from "react";
import { FilePlus2, History } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { HEADS, RUNS, generateInvoices, previewInvoiceRun, useFeesStore } from "@/lib/fees-setup";
import { CLASSES, className } from "@/lib/mock";
import { formatDateOn, formatINR, formatIST } from "@/lib/time";
import { ConfirmDialog } from "./confirm-dialog";

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function Pick({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-fill px-3.5 py-2.5 text-sm">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />{label}
    </label>
  );
}

export function GenerateTab({ by }: { by: string }) {
  useFeesStore(); // re-render when invoices or fee setup change, so the preview never goes stale
  const [period, setPeriod] = React.useState("Term 3");
  const [dueOn, setDueOn] = React.useState("2027-01-10");
  const [classIds, setClassIds] = React.useState<string[]>(CLASSES.map((c) => c.id));
  const [headIds, setHeadIds] = React.useState<string[]>(HEADS.filter((h) => h.frequency !== "once" && !/transport/i.test(h.name)).map((h) => h.id));
  const [confirm, setConfirm] = React.useState(false);

  const problem = !period.trim() ? "Enter a period name, for example Term 3."
    : !/^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? "Choose a due date."
    : !classIds.length ? "Choose at least one class."
    : !headIds.length ? "Choose at least one fee head." : "";
  const preview = problem ? null : previewInvoiceRun({ period, dueOn, headIds, classIds });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><div><CardTitle>Generate</CardTitle></div></CardHeader>
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Period" htmlFor="gen-period"><Input id="gen-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Term 3" /></Field>
            <Field label="Due" htmlFor="gen-due"><Input id="gen-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></Field>
          </div>
          <fieldset className="flex flex-col gap-2.5"><legend className="mb-2.5 text-sm font-medium">Classes</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{CLASSES.map((c) => <Pick key={c.id} id={`gc-${c.id}`} label={`Class ${className(c.id)}`} checked={classIds.includes(c.id)} onChange={() => setClassIds((l) => toggle(l, c.id))} />)}</div>
            <button type="button" className="cursor-pointer self-start text-xs font-medium text-brand hover:underline" onClick={() => setClassIds(classIds.length === CLASSES.length ? [] : CLASSES.map((c) => c.id))}>{classIds.length === CLASSES.length ? "Clear all" : "Select all"}</button>
          </fieldset>
          <fieldset className="flex flex-col gap-2.5"><legend className="mb-2.5 text-sm font-medium">Heads</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{HEADS.map((h) => <Pick key={h.id} id={`gh-${h.id}`} label={h.name} checked={headIds.includes(h.id)} onChange={() => setHeadIds((l) => toggle(l, h.id))} />)}</div>
            {!HEADS.length && <p className="text-sm text-muted-foreground">No heads.</p>}
          </fieldset>
        </div>
      </Card>

      <section aria-label="Preview" className="flex flex-col gap-4">
        {problem ? <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">{problem}</p> : preview && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Students" value={preview.students} />
              <StatCard label="Total" value={formatINR(preview.totalPaise)} />
              <StatCard label="Concessions" value={preview.withConcessions} />
              <StatCard label="Previous dues" value={preview.withPrevDues} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="brand" size="lg" disabled={!preview.students} onClick={() => setConfirm(true)}><FilePlus2 /> Generate</Button>
              {!preview.students && <span className="text-sm text-muted-foreground">Already billed.</span>}
            </div>
          </>
        )}
      </section>

      {!RUNS.length ? <EmptyState icon={History} title="No runs" /> : (
        <Card>
          <CardHeader><CardTitle>Runs</CardTitle></CardHeader>
          <ul className="flex flex-col">
            {RUNS.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 text-sm first:border-t-0 first:pt-0">
                <div><p className="font-medium">{r.period} · {r.created} · {formatINR(r.totalPaise)}</p>
                  <p className="text-xs text-text-tertiary">{formatDateOn(r.dueOn)} · {r.headIds.map((h) => HEADS.find((x) => x.id === h)?.name ?? "Removed head").join(", ")}{r.skipped ? ` · ${r.skipped} skipped` : ""}</p></div>
                <p className="text-xs text-muted-foreground">{formatIST(r.at)} · {r.by}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={`Generate ${period.trim()}?`} confirmLabel="Generate"
        description="Earlier unpaid balances carry forward."
        onConfirm={() => {
          const run = generateInvoices({ period, dueOn, headIds, classIds, by });
          toast.success(`${run.created} generated`);
        }}>
        {preview && <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm"><span>{preview.students} · {formatDateOn(dueOn)}</span><b className="tabular-nums">{formatINR(preview.totalPaise)}</b></div>}
      </ConfirmDialog>
    </div>
  );
}
