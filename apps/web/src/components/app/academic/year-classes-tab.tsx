"use client";
import * as React from "react";
import { CalendarPlus, Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { addSection, addYear, currentYear, customClassNames, deleteBlocker, deleteClass, setCurrentYear, STANDARD_GRADES, useAcademic, type SetupClass } from "@/lib/academic-setup";
import { ARCHIVED_CLASSES, className } from "@/lib/mock";
import { formatDateOn } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { ConfirmDialog } from "./confirm-dialog";
import { CustomClassDialog } from "./classes/custom-class-dialog";
import { GradeRow } from "./classes/grade-row";
import { SectionDialog, type SectionMode } from "./classes/section-dialog";

export function YearClassesTab() {
  const { years, classes } = useAcademic();
  const { run, is } = usePending(600);
  const [yearId, setYearId] = React.useState(() => currentYear().id);
  const [yearDlg, setYearDlg] = React.useState(false);
  const [yearErr, setYearErr] = React.useState("");
  const [customDlg, setCustomDlg] = React.useState(false);
  const [section, setSection] = React.useState<SectionMode | null>(null);
  const [del, setDel] = React.useState<SetupClass | null>(null);
  const year = years.find((y) => y.id === yearId) ?? years[0];
  const isCurrent = year.current;
  const inYear = classes.filter((c) => c.yearId === year.id);
  const customNames = isCurrent ? customClassNames() : [];
  const blocker = del ? deleteBlocker(del.id) : null;

  return (
    <div className="flex flex-col gap-4">

      <Card>
        <CardHeader className="mb-0 items-center">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="year-select" className="text-sm font-medium">Academic year</label>
            <NativeSelect id="year-select" className="w-44" value={year.id} onChange={(e) => setYearId(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.current ? " (current)" : y.status === "completed" ? " (completed)" : ""}</option>)}
            </NativeSelect>
            <Badge tone={isCurrent ? "success" : "neutral"}>{isCurrent ? "Current" : year.status === "completed" ? "Completed" : "Draft"}</Badge>
            <span className="text-sm tabular-nums text-muted-foreground">{formatDateOn(year.fromOn)} to {formatDateOn(year.toOn)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isCurrent && year.status !== "completed" && <Button size="sm" variant="secondary" loading={is(`y-${year.id}`)} onClick={() => run(`y-${year.id}`, () => { setCurrentYear(year.id); toast.success(`${year.label} is current`); })}>Set current</Button>}
            <Button size="sm" variant="secondary" onClick={() => { setYearErr(""); setYearDlg(true); }}><CalendarPlus /> New year</Button>
          </div>
        </CardHeader>
      </Card>

      {year.status === "completed" ? (
        <Card>
          <CardHeader><CardTitle>Classes {year.label}</CardTitle><Badge>Read-only</Badge></CardHeader>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {ARCHIVED_CLASSES.filter((c) => c.yearLabel === year.label).map((c) => <li key={c.id} className="rounded-xl bg-fill px-4 py-3 text-sm"><b>{c.grade}-{c.section}</b> <span className="text-muted-foreground tabular-nums">· {c.students} students</span></li>)}
            {!ARCHIVED_CLASSES.some((c) => c.yearLabel === year.label) && <li className="text-sm text-muted-foreground">No classes.</li>}
          </ul>
        </Card>
      ) : !isCurrent ? (
        <EmptyState icon={Layers} title={`${year.label} is a draft`}
          action={<Button variant="brand" loading={is(`y-${year.id}`)} onClick={() => run(`y-${year.id}`, () => { setCurrentYear(year.id); toast.success(`${year.label} is current`); })}>Set current</Button>} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Classes</CardTitle>
              <Button variant="brand" size="sm" onClick={() => setCustomDlg(true)}><Plus /> Custom</Button>
            </CardHeader>
            <ul>
              {STANDARD_GRADES.map((g) => {
                const secs = inYear.filter((c) => c.grade === g);
                return (
                  <GradeRow key={g} title={`Class ${g}`} sections={secs} busy={is(`use-${g}`)}
                    onAdd={() => setSection({ kind: "add", grade: g, custom: false })}
                    onUse={() => run(`use-${g}`, () => { const r = addSection(g, "A", 40); if (r.ok) toast.success(`${g}-A added`); else toast.error(r.error); })}
                    onEdit={(c) => setSection({ kind: "edit", cls: c })} onDelete={setDel} />
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader><CardTitle>Custom classes</CardTitle></CardHeader>
            {customNames.length === 0 ? (
              <EmptyState icon={Layers} title="No custom classes" action={<Button variant="brand" onClick={() => setCustomDlg(true)}><Plus /> Custom</Button>} />
            ) : (
              <ul>
                {customNames.map((n) => {
                  const secs = inYear.filter((c) => c.grade === n);
                  return <GradeRow key={n} title={n} sub={`Order ${secs[0]?.order ?? 0}`} sections={secs} onAdd={() => setSection({ kind: "add", grade: n, custom: true })} onEdit={(c) => setSection({ kind: "edit", cls: c })} onDelete={setDel} />;
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      <CustomClassDialog open={customDlg} onClose={() => setCustomDlg(false)} />
      <SectionDialog mode={section} onClose={() => setSection(null)} />

      <Dialog open={yearDlg} onOpenChange={setYearDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>New year</DialogTitle><DialogDescription className="sr-only">Add an academic year.</DialogDescription></DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            run("year", () => { const r = addYear(String(f.get("label")).trim(), String(f.get("from")), String(f.get("to"))); if (!r.ok) { setYearErr(r.error); return; } setYearDlg(false); toast.success("Year added"); });
          }}>
            <Field label="Year" htmlFor="yl"><Input id="yl" name="label" placeholder="2028-29" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts" htmlFor="yf"><Input id="yf" name="from" type="date" required /></Field>
              <Field label="Ends" htmlFor="yt"><Input id="yt" name="to" type="date" required /></Field>
            </div>
            {yearErr && <p role="alert" className="text-sm text-danger">{yearErr}</p>}
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setYearDlg(false)}>Cancel</Button><Button type="submit" variant="brand" loading={is("year")}>Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} loading={is("del")}
        title={blocker ? "Cannot delete" : "Delete class?"}
        text={blocker ?? (del ? `${className(del.id)} is removed.` : "")}
        confirmLabel="Delete" disabled={!!blocker}
        onConfirm={() => { if (!del || blocker) return; run("del", () => { const r = deleteClass(del.id); if (r.ok) toast.success("Deleted"); else toast.error(r.error); setDel(null); }); }} />
    </div>
  );
}
