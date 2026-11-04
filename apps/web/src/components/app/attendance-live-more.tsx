"use client";
import * as React from "react";
import { CalendarDays, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { ErrorBlock } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { StatCard } from "@/components/app/stat-card";
import { PeriodPicker, SkPlainStat, pct } from "@/components/app/attendance-live-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Appear, SkBars, SkChart, SkTableRows, Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAddHoliday, useAnalytics, useBelow, useDeleteHoliday, useEditHoliday, useHolidays, useSaveStaffDay, useStaffSheet, type HolidayOut } from "@/lib/api/hooks/attendance";
import { errorText } from "@/lib/api/hooks/staff";
import { formatDateOn } from "@/lib/time";
import { cn } from "@/lib/utils";

const WEEKDAY = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function Bar({ value, danger }: { value: number | null; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill"><div className={cn("h-full rounded-full", danger ? "bg-danger" : "bg-solid")} style={{ width: `${value ?? 0}%` }} /></div>
      <span className="w-14 text-right text-sm tabular-nums">{pct(value)}</span>
    </div>
  );
}

/** School-wide (or your classes) numbers from the analytics endpoint. */
export function OverviewTab({ today, classId }: { today: string; classId?: string }) {
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [scope, setScope] = React.useState<"all" | "class">("all");
  const q = useAnalytics({ month: month || undefined }, scope === "class" ? classId : undefined);
  const d = q.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker month={month} setMonth={setMonth} today={today} />
        {classId && <NativeSelect aria-label="Scope" className="w-48" value={scope} onChange={(e) => setScope(e.target.value as "all" | "class")}><option value="all">All classes</option><option value="class">This class</option></NativeSelect>}
      </div>
      {q.isPending ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only">Loading</span>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <SkPlainStat key={i} />)}</div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><div className="mb-6"><Skeleton className="h-5 w-24" /></div><SkBars rows={5} /></Card>
            <Card><div className="mb-6"><Skeleton className="h-5 w-24" /></div><SkBars rows={5} /></Card>
          </div>
          <Card><div className="mb-6"><Skeleton className="h-5 w-16" /></div><SkChart height={112} /></Card>
        </div>
      ) : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : d && (
        <Appear className={cn("flex flex-col gap-4", q.isPlaceholderData && "opacity-60")}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Attendance" value={pct(d.overall_percentage)} />
            <StatCard label="Days" value={d.marked_days} />
            <StatCard label={`Below ${d.threshold}%`} value={d.students_below_threshold} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>By class</CardTitle></CardHeader>
              {d.by_class.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
                <ul className="flex flex-col gap-3">{[...d.by_class].sort((a, b) => (a.percentage ?? 101) - (b.percentage ?? 101)).map((c) => (
                  <li key={c.class_id} className="grid grid-cols-[88px_1fr] items-center gap-3 text-sm"><span className="font-medium">Class {c.class_label}</span><Bar value={c.percentage} danger={(c.percentage ?? 100) < d.threshold} /></li>
                ))}</ul>
              )}
            </Card>
            <Card>
              <CardHeader><CardTitle>By weekday</CardTitle></CardHeader>
              {d.by_weekday.every((w) => w.percentage === null) ? <p className="text-sm text-muted-foreground">No data.</p> : (
                <ul className="flex flex-col gap-3">{d.by_weekday.filter((w) => w.percentage !== null).map((w) => (
                  <li key={w.weekday} className="grid grid-cols-[88px_1fr] items-center gap-3 text-sm"><span className="font-medium">{WEEKDAY[w.weekday]}</span><Bar value={w.percentage} /></li>
                ))}</ul>
              )}
            </Card>
          </div>
          {d.trend.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Daily</CardTitle></CardHeader>
              <div className="flex h-28 items-end gap-1" role="img" aria-label="Attendance percentage for each marked day">
                {d.trend.map((t) => <div key={t.day_on} title={`${formatDateOn(t.day_on)}: ${pct(t.percentage)}`} className="min-w-1 max-w-8 flex-1 rounded-t bg-solid" style={{ height: `${Math.max(4, t.percentage ?? 0)}%` }} />)}
              </div>
            </Card>
          )}
        </Appear>
      )}
    </div>
  );
}

const PAGE = 25;
export function BelowTab({ today, classId }: { today: string; classId?: string }) {
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [threshold, setThreshold] = React.useState(75);
  const [scope, setScope] = React.useState<"all" | "class">("all");
  const [page, setPage] = React.useState(0);
  const q = useBelow({ month: month || undefined }, scope === "class" ? classId : undefined, threshold, page * PAGE, PAGE);
  const total = q.data?.total ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker month={month} setMonth={(m) => { setMonth(m); setPage(0); }} today={today} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Below
          <Input aria-label="Threshold percent" type="number" min={0} max={100} className="w-20" value={threshold} onChange={(e) => { setThreshold(Math.min(100, Math.max(0, Number(e.target.value) || 0))); setPage(0); }} />%
        </label>
        {classId && <NativeSelect aria-label="Scope" className="w-48" value={scope} onChange={(e) => { setScope(e.target.value as "all" | "class"); setPage(0); }}><option value="all">All classes</option><option value="class">This class</option></NativeSelect>}
      </div>
      {q.isPending ? (
        <Card role="status" aria-busy="true">
          <span className="sr-only">Loading</span>
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="w-48">Attendance</TableHead></TableRow></TableHeader>
            <TableBody><SkTableRows rows={6} cols={4} /></TableBody>
          </Table>
        </Card>
      ) : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : total === 0 ? (
        <EmptyState icon={UsersRound} title="Nobody below" />
      ) : (
        <Card className={cn("appear", q.isPlaceholderData && "opacity-60")}>
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="w-48">Attendance</TableHead></TableRow></TableHeader>
            <TableBody>{q.data?.items.map((r) => (
              <TableRow key={r.student_id}>
                <TableCell><span className="font-medium">{r.name}</span><span className="block text-xs text-text-tertiary">{r.scholar_no}</span></TableCell>
                <TableCell>Class {r.class_label}</TableCell>
                <TableCell className="text-right tabular-nums">{r.working_days}</TableCell>
                <TableCell><Bar value={r.percentage} danger /></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          {total > PAGE && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span className="tabular-nums">{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total}</span>
              <span className="flex gap-2"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next</Button></span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- holidays */
const KINDS = [["holiday", "Holiday"], ["exam", "Exam"], ["event", "Event"]] as const;
const KIND_TONE = { holiday: "brand", exam: "warning", event: "neutral" } as const;

export function HolidaysTab({ canEdit }: { canEdit: boolean }) {
  const q = useHolidays();
  const [form, setForm] = React.useState<HolidayOut | "new" | null>(null);
  const [del, setDel] = React.useState<HolidayOut | null>(null);
  const remove = useDeleteHoliday();
  const sorted = React.useMemo(() => [...(q.data ?? [])].sort((a, b) => a.from_on.localeCompare(b.from_on)), [q.data]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span />
        {canEdit && <Button variant="brand" onClick={() => setForm("new")}><Plus /> Add</Button>}
      </div>
      {q.isPending ? (
        <Card role="status" aria-busy="true">
          <span className="sr-only">Loading</span>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead>{canEdit && <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>}</TableRow></TableHeader>
            <TableBody><SkTableRows rows={6} cols={canEdit ? 4 : 3} /></TableBody>
          </Table>
        </Card>
      ) : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : sorted.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No holidays" />
      ) : (
        <Card className="appear">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead>{canEdit && <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>}</TableRow></TableHeader>
            <TableBody>{sorted.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.title}</TableCell>
                <TableCell><Badge tone={KIND_TONE[h.kind as keyof typeof KIND_TONE] ?? "neutral"}>{KINDS.find((k) => k[0] === h.kind)?.[1] ?? h.kind}</Badge></TableCell>
                <TableCell className="text-sm tabular-nums">{h.from_on === h.to_on ? formatDateOn(h.from_on) : `${formatDateOn(h.from_on, "short")} – ${formatDateOn(h.to_on)}`}</TableCell>
                {canEdit && <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Edit ${h.title}`} onClick={() => setForm(h)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={`Delete ${h.title}`} onClick={() => setDel(h)}><Trash2 /></Button></div></TableCell>}
              </TableRow>
            ))}</TableBody>
          </Table>
        </Card>
      )}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}><DialogContent>{form && <HolidayForm key={form === "new" ? "new" : form.id} holiday={form === "new" ? null : form} onDone={() => setForm(null)} />}</DialogContent></Dialog>
      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {del?.title}?</DialogTitle></DialogHeader>
          {remove.isError && <p role="alert" className="text-sm text-danger">{errorText(remove.error)}</p>}
          <DialogFooter><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button>
            <Button variant="destructive" loading={remove.isPending} onClick={() => del && remove.mutate(del.id, { onSuccess: () => { setDel(null); toast.success("Holiday deleted"); } })}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HolidayForm({ holiday, onDone }: { holiday: HolidayOut | null; onDone: () => void }) {
  const add = useAddHoliday(), edit = useEditHoliday();
  const [err, setErr] = React.useState<string | null>(null);
  const [from, setFrom] = React.useState(holiday?.from_on ?? "");
  const pending = add.isPending || edit.isPending;
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { title: String(f.get("title")).trim(), from_on: String(f.get("from")), to_on: String(f.get("to") || "") || null, kind: String(f.get("kind")) as "holiday" };
    const cb = { onSuccess: () => { onDone(); toast.success(holiday ? "Holiday updated" : "Holiday added"); }, onError: (x: unknown) => setErr(errorText(x)) };
    setErr(null);
    if (holiday) edit.mutate({ id: holiday.id, body }, cb); else add.mutate(body, cb);
  }
  return (
    <>
      <DialogHeader><DialogTitle>{holiday ? "Edit holiday" : "Add holiday"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Title" htmlFor="h-title"><Input id="h-title" name="title" required maxLength={200} defaultValue={holiday?.title} placeholder="Diwali break" /></Field>
        <Field label="Type" htmlFor="h-kind"><NativeSelect id="h-kind" name="kind" defaultValue={holiday?.kind ?? "holiday"}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="h-from"><Input id="h-from" name="from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="h-to"><Input id="h-to" name="to" type="date" min={from || undefined} defaultValue={holiday && holiday.to_on !== holiday.from_on ? holiday.to_on : ""} /></Field>
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <DialogFooter><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" variant="brand" loading={pending}>{holiday ? "Save" : "Add"}</Button></DialogFooter>
      </form>
    </>
  );
}

/* ---------------------------------------------------------------- staff attendance */
type StaffStatus = "present" | "absent" | "leave";
const STAFF_OPTS: [StaffStatus, string][] = [["present", "Present"], ["absent", "Absent"], ["leave", "Leave"]];

export function StaffAttendanceTab({ today }: { today: string }) {
  const [day, setDay] = React.useState(today);
  return (
    <div className="flex flex-col gap-4">
      <Input aria-label="Day (IST)" type="date" className="w-44" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
      <StaffSheet key={day} day={day} />
    </div>
  );
}

function StaffSheet({ day }: { day: string }) {
  const q = useStaffSheet(day, true);
  const save = useSaveStaffDay();
  const [edits, setEdits] = React.useState<Record<string, { status: StaffStatus; reason: string }>>({});
  const [err, setErr] = React.useState<string | null>(null);
  const rows = q.data ?? [];
  const get = (id: string, status: StaffStatus | null, reason: string | null | undefined) => edits[id] ?? (status ? { status, reason: reason ?? "" } : null);
  const pending = Object.keys(edits).length;

  function onSave() {
    setErr(null);
    save.mutate({ day, records: Object.entries(edits).map(([staff_id, v]) => ({ staff_id, status: v.status, reason: v.status === "present" ? null : v.reason.trim() || null })) }, {
      onSuccess: () => { setEdits({}); toast.success("Saved"); },
      onError: (e) => setErr(errorText(e)),
    });
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" disabled={!rows.length} onClick={() => setEdits(Object.fromEntries(rows.filter((r) => r.status !== "present").map((r) => [r.staff_id, { status: "present" as const, reason: "" }])))}>All present</Button>
      </div>
      {q.isPending ? (
        <Card role="status" aria-busy="true" className="p-2 sm:p-3">
          <span className="sr-only">Loading</span>
          <ul aria-hidden="true">{Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-3"><div className="min-w-0 flex-1 basis-40"><Skeleton className="h-4 w-1/3" /></div><Skeleton className="h-9 w-56 rounded-full" /></li>
          ))}</ul>
        </Card>
      ) : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState icon={UsersRound} title="No staff" /> : (
        <Appear className="flex flex-col gap-4">
          <Card className="p-2 sm:p-3">
            <ul>{rows.map((r) => {
              const cur = get(r.staff_id, r.status, r.reason);
              return (
                <li key={r.staff_id} className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3 hover:bg-card-hover">
                  <span className="min-w-0 flex-1 basis-40 truncate font-medium">{r.name}</span>
                  {cur && cur.status !== "present" && <Input aria-label={`Reason for ${r.name}`} className="w-56" placeholder="Reason" maxLength={500} value={cur.reason} onChange={(e) => setEdits((x) => ({ ...x, [r.staff_id]: { status: cur.status, reason: e.target.value } }))} />}
                  <div role="radiogroup" aria-label={`Attendance for ${r.name}`} className="inline-flex gap-0.5 rounded-full bg-fill p-[3px]">
                    {STAFF_OPTS.map(([v, label]) => (
                      <button key={v} type="button" role="radio" aria-checked={cur?.status === v} onClick={() => cur?.status !== v && setEdits((x) => ({ ...x, [r.staff_id]: { status: v, reason: cur?.reason ?? "" } }))}
                        className={cn("h-8 rounded-full px-3 text-sm font-medium text-muted-foreground", cur?.status === v && (v === "present" ? "bg-solid text-on-solid" : "bg-solid text-on-solid"))}>{label}</button>
                    ))}
                  </div>
                </li>
              );
            })}</ul>
          </Card>
          <div className="flex flex-wrap items-center justify-end gap-4">
            {err && <p role="alert" className="mr-auto text-sm text-danger">{err}</p>}
            <Button variant="brand" size="lg" loading={save.isPending} disabled={pending === 0} onClick={onSave}>Save</Button>
          </div>
        </Appear>
      )}
    </div>
  );
}
