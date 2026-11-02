"use client";
import * as React from "react";
import { CalendarPlus, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { ConfirmDialog } from "@/components/app/academic/confirm-dialog";
import { GuideStrip } from "@/components/app/academic/classes/guide-strip";
import { ErrorBlock, LoadingBlock, STANDARD_GRADES, classLabel } from "@/components/app/academic-live-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { errorText, useAddClass, useAddYear, useClasses, useDeleteClass, useEditClass, useSetCurrentYear, useYears } from "@/lib/api/hooks/academic";
import type { ClassOut } from "@/lib/api/types";
import { formatDateOn } from "@/lib/time";

type SectionMode = { kind: "add"; grade: string; custom: boolean; yearId: string } | { kind: "edit"; cls: ClassOut };

export function AcademicLiveClasses() {
  const years = useYears();
  const [picked, setPicked] = React.useState<string | null>(null);
  const list = years.data?.items ?? [];
  const year = list.find((y) => y.id === picked) ?? list.find((y) => y.status === "current") ?? list[0];
  const classes = useClasses(year?.id);
  const setCurrent = useSetCurrentYear();
  const del = useDeleteClass();
  const add = useAddClass();
  const [yearDlg, setYearDlg] = React.useState(false);
  const [customDlg, setCustomDlg] = React.useState(false);
  const [section, setSection] = React.useState<SectionMode | null>(null);
  const [toDelete, setToDelete] = React.useState<ClassOut | null>(null);
  const [delErr, setDelErr] = React.useState("");

  if (years.isPending) return <LoadingBlock label="Loading academic years" />;
  if (years.isError) return <ErrorBlock error={years.error} onRetry={() => years.refetch()} />;

  const items = classes.data?.items ?? [];
  const customNames = [...new Set(items.filter((c) => c.is_custom).map((c) => c.grade))];
  const completed = year?.status === "completed";
  const isCurrent = year?.status === "current";

  function makeCurrent(id: string, label: string) {
    setCurrent.mutate(id, { onSuccess: () => toast.success(`${label} is now the current year`), onError: (e) => toast.error(errorText(e)) });
  }
  function pickGrade(g: string) {
    if (!year) return;
    add.mutate({ academic_year_id: year.id, grade: g, section: "A", capacity: 40 }, {
      onSuccess: () => toast.success(`Class ${g}-A added`, { description: "Now choose its subjects." }), onError: (e) => toast.error(errorText(e)),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <GuideStrip active={1} />

      <Card>
        <CardHeader className="mb-0 items-center">
          {year ? (
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="year-select" className="text-sm font-medium">Academic year</label>
              <NativeSelect id="year-select" className="w-44" value={year.id} onChange={(e) => setPicked(e.target.value)}>
                {list.map((y) => <option key={y.id} value={y.id}>{y.name}{y.status === "current" ? " (current)" : y.status === "completed" ? " (completed)" : ""}</option>)}
              </NativeSelect>
              <Badge tone={isCurrent ? "success" : "neutral"}>{isCurrent ? "Current" : completed ? "Completed" : "Draft"}</Badge>
              <span className="text-sm tabular-nums text-muted-foreground">{formatDateOn(year.starts_on)} to {formatDateOn(year.ends_on)}</span>
            </div>
          ) : <p className="text-sm text-muted-foreground">No academic year yet.</p>}
          <div className="flex flex-wrap gap-2">
            {year && !isCurrent && !completed && <Button size="sm" variant="secondary" loading={setCurrent.isPending} onClick={() => makeCurrent(year.id, year.name)}>Set as current</Button>}
            <Button size="sm" variant="secondary" onClick={() => setYearDlg(true)}><CalendarPlus /> New year</Button>
          </div>
        </CardHeader>
      </Card>

      {!year ? (
        <EmptyState icon={CalendarPlus} title="Add your first academic year" text="Every class belongs to an academic year. Add one, then make it the current year."
          action={<Button variant="brand" onClick={() => setYearDlg(true)}><CalendarPlus /> New year</Button>} />
      ) : classes.isPending ? <LoadingBlock label="Loading classes" />
        : classes.isError ? <ErrorBlock error={classes.error} onRetry={() => classes.refetch()} />
        : completed ? (
          <Card>
            <CardHeader><div><CardTitle>Classes of {year.name}</CardTitle><CardDescription>This year is completed and read-only. Its classes stay as the archive.</CardDescription></div></CardHeader>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((c) => <li key={c.id} className="rounded-xl bg-fill px-4 py-3 text-sm"><b>{classLabel(c)}</b> <span className="text-muted-foreground tabular-nums">· {c.students} students</span></li>)}
              {items.length === 0 && <li className="text-sm text-muted-foreground">No classes were kept for this year.</li>}
            </ul>
          </Card>
        ) : (
          <>
            {!isCurrent && <p className="rounded-xl bg-fill px-4 py-3 text-sm text-muted-foreground">{year.name} is a draft. You can prepare its classes now and set it as current when the year begins.</p>}
            <Card>
              <CardHeader>
                <div><CardTitle>Classes for {year.name}</CardTitle><CardDescription>Grades 1 to 12 are always here. You only add sections (A, B, C...) to the grades your school uses.</CardDescription></div>
                <Button variant="brand" size="sm" onClick={() => setCustomDlg(true)}><Plus /> Custom class</Button>
              </CardHeader>
              <ul>
                {STANDARD_GRADES.map((g) => (
                  <GradeLine key={g} title={`Class ${g}`} sections={items.filter((c) => c.grade === g && !c.is_custom)} busy={add.isPending && add.variables?.grade === g}
                    onAdd={() => setSection({ kind: "add", grade: g, custom: false, yearId: year.id })} onUse={() => pickGrade(g)}
                    onEdit={(c) => setSection({ kind: "edit", cls: c })} onDelete={(c) => { setDelErr(""); setToDelete(c); }} />
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Your own classes</CardTitle><CardDescription>Nursery, LKG, UKG, KG-1, Pre-primary and any other class outside grades 1 to 12.</CardDescription></div></CardHeader>
              {customNames.length === 0 ? (
                <EmptyState icon={Layers} title="No custom classes" text="Create Nursery, LKG or any class your school has. Pick its name, its order and its first section." action={<Button variant="brand" onClick={() => setCustomDlg(true)}><Plus /> Custom class</Button>} />
              ) : (
                <ul>
                  {customNames.map((n) => {
                    const secs = items.filter((c) => c.grade === n && c.is_custom);
                    return <GradeLine key={n} title={n} sub={`Order ${secs[0]?.display_order ?? 0}`} sections={secs} onAdd={() => setSection({ kind: "add", grade: n, custom: true, yearId: year.id })}
                      onEdit={(c) => setSection({ kind: "edit", cls: c })} onDelete={(c) => { setDelErr(""); setToDelete(c); }} />;
                  })}
                </ul>
              )}
            </Card>
          </>
        )}

      <YearDialog open={yearDlg} onClose={() => setYearDlg(false)} />
      {year && <CustomDialog open={customDlg} yearId={year.id} onClose={() => setCustomDlg(false)} />}
      <SectionDialog mode={section} onClose={() => setSection(null)} />

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} loading={del.isPending}
        title={`Delete class ${toDelete ? classLabel(toDelete) : ""}?`}
        text={delErr || (toDelete && toDelete.students > 0 ? `This class has ${toDelete.students} students. Move them first, or the API will refuse.` : "The section and its subject list are removed. This cannot be undone.")}
        confirmLabel="Delete class"
        onConfirm={() => toDelete && del.mutate(toDelete.id, { onSuccess: () => { toast.success("Class deleted"); setToDelete(null); }, onError: (e) => setDelErr(errorText(e)) })} />
    </div>
  );
}

function GradeLine({ title, sub, sections, onAdd, onUse, busy, onEdit, onDelete }: {
  title: string; sub?: string; sections: ClassOut[]; busy?: boolean; onAdd: () => void; onUse?: () => void; onEdit: (c: ClassOut) => void; onDelete: (c: ClassOut) => void;
}) {
  const used = sections.length > 0;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="w-32 shrink-0">
        <p className={used ? "font-bold" : "font-medium text-muted-foreground"}>{title}</p>
        {sub && <p className="text-xs text-text-tertiary">{sub}</p>}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {!used && <Badge>Not used</Badge>}
        {sections.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-fill py-1 pl-3.5 pr-1 text-sm">
            <span className="font-medium">{classLabel(c)}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{c.students}/{c.capacity}</span>
            {c.students >= c.capacity && <span className="text-xs text-warning">Full</span>}
            <Button size="icon-sm" variant="ghost" className="size-7" aria-label={`Edit class ${classLabel(c)}`} onClick={() => onEdit(c)}><Pencil className="size-3.5" /></Button>
            <Button size="icon-sm" variant="ghost" className="size-7" aria-label={`Delete class ${classLabel(c)}`} onClick={() => onDelete(c)}><Trash2 className="size-3.5" /></Button>
          </span>
        ))}
      </div>
      {used
        ? <Button size="sm" variant="secondary" onClick={onAdd} aria-label={`Add section to ${title}`}><Plus /> Add section</Button>
        : <Button size="sm" variant="brand" loading={busy} onClick={onUse ?? onAdd} aria-label={`Use ${title}`}><Plus /> Use this grade</Button>}
    </li>
  );
}

function YearDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddYear();
  const [err, setErr] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setErr(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>New academic year</DialogTitle><DialogDescription>It is added as a draft. Set it as current when the year begins.</DialogDescription></DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget); setErr("");
          add.mutate({ name: String(f.get("label")).trim(), starts_on: String(f.get("from")), ends_on: String(f.get("to")) }, {
            onSuccess: () => { onClose(); toast.success("Academic year added as draft"); }, onError: (e) => setErr(errorText(e)),
          });
        }}>
          <Field label="Year" htmlFor="yl" hint="Write it as 2028-29"><Input id="yl" name="label" placeholder="2028-29" minLength={4} maxLength={20} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts on" htmlFor="yf"><Input id="yf" name="from" type="date" required /></Field>
            <Field label="Ends on" htmlFor="yt"><Input id="yt" name="to" type="date" required /></Field>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={add.isPending}>Add year</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomDialog({ open, yearId, onClose }: { open: boolean; yearId: string; onClose: () => void }) {
  const add = useAddClass();
  const [err, setErr] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setErr(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a custom class</DialogTitle>
          <DialogDescription>For classes outside grades 1 to 12, such as Nursery, LKG, UKG or Pre-primary.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget); setErr("");
          const name = String(f.get("name")).trim();
          add.mutate({ academic_year_id: yearId, grade: name, section: String(f.get("section")).trim(), capacity: Number(f.get("capacity")), is_custom: true, display_order: Number(f.get("order")) }, {
            onSuccess: () => { toast.success(`${name} added`, { description: "Choose its subjects next, then its teachers." }); onClose(); }, onError: (e) => setErr(errorText(e)),
          });
        }}>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label="Class name" htmlFor="cc-name"><Input id="cc-name" name="name" placeholder="Nursery" maxLength={40} autoFocus required /></Field>
            <Field label="Order" htmlFor="cc-order" hint="Lower comes first"><Input id="cc-order" name="order" type="number" defaultValue={0} min={-50} max={99} required /></Field>
          </div>
          <p className="-mt-2 text-xs text-text-tertiary">Grades 1 to 12 use the order 1 to 12. Use 0 or lower to list a class before grade 1, for example Nursery -3, LKG -2, UKG -1.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First section" htmlFor="cc-sec"><Input id="cc-sec" name="section" defaultValue="A" maxLength={20} required /></Field>
            <Field label="Capacity" htmlFor="cc-cap" hint="Most students this section can hold"><Input id="cc-cap" name="capacity" type="number" min={1} max={200} defaultValue={30} required /></Field>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={add.isPending}>Add class</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionDialog({ mode, onClose }: { mode: SectionMode | null; onClose: () => void }) {
  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{mode && <SectionBody mode={mode} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SectionBody({ mode, onClose }: { mode: SectionMode; onClose: () => void }) {
  const add = useAddClass();
  const edit = useEditClass();
  const [err, setErr] = React.useState("");
  const cls = mode.kind === "edit" ? mode.cls : null;
  const grade = cls ? cls.grade : mode.kind === "add" ? mode.grade : "";
  const pending = add.isPending || edit.isPending;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{cls ? `Edit class ${classLabel(cls)}` : `Add a section to ${mode.kind === "add" && mode.custom ? grade : `class ${grade}`}`}</DialogTitle>
        <DialogDescription>{cls ? "Students stay in the class when you rename its section." : "Use A, B, C or any name your school uses, such as Rose."}</DialogDescription>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setErr("");
        const [section, capacity] = [String(f.get("section")).trim(), Number(f.get("capacity"))];
        const done = (msg: string) => ({ onSuccess: () => { toast.success(msg); onClose(); }, onError: (x: unknown) => setErr(errorText(x)) });
        if (cls) edit.mutate({ id: cls.id, section, capacity }, done("Class updated"));
        else if (mode.kind === "add") add.mutate({ academic_year_id: mode.yearId, grade, section, capacity, is_custom: mode.custom }, done(`Class ${grade}-${section} added`));
      }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Section" htmlFor="sd-section" hint="A, B, C or any short name"><Input id="sd-section" name="section" maxLength={20} defaultValue={cls?.section ?? ""} autoFocus required /></Field>
          <Field label="Capacity" htmlFor="sd-cap" hint="Most students this section can hold"><Input id="sd-cap" name="capacity" type="number" min={1} max={200} defaultValue={cls?.capacity ?? 40} required /></Field>
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={pending}>{cls ? "Save" : "Add section"}</Button></DialogFooter>
      </form>
    </>
  );
}
