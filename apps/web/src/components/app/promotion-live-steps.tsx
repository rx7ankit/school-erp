"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, Search } from "lucide-react";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { Field } from "@/components/app/field";
import { StatCard } from "@/components/app/stat-card";
import { ChoiceGroup } from "@/components/app/rollover/choice-card";
import { DecisionToggle } from "@/components/app/rollover/decision-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/components/app/can";
import { isConnected } from "@/lib/features";
import { usePanels, useReadiness, type ApiDecision, type ClassPanel, type RolloverPlan, type RolloverPreview, type StudentHint } from "@/lib/api/hooks/rollover";
import { formatDateOn, formatINR } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface LiveStepProps { plan: RolloverPlan; update: (f: (p: RolloverPlan) => RolloverPlan) => void }
type UiDecision = "promote" | "stay" | "leave";

/* ------------------------------------------------------------------ readiness */
export function ReadinessLive({ compact, onLeave }: { compact?: boolean; onLeave?: () => void }) {
  const r = useReadiness();
  if (r.isPending) return <LoadingBlock label="Checking the school" />;
  if (r.isError) return <ErrorBlock error={r.error} onRetry={() => r.refetch()} />;
  return (
    <ul className="flex flex-col gap-2" aria-label="Readiness checks">
      {r.data.items.map((x) => (
        <li key={x.key} className="flex items-start gap-3 rounded-xl bg-fill px-4 py-3 text-sm">
          {x.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="All good" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Needs a look" />}
          <span className="min-w-0 flex-1">
            {x.label}{x.amount_paise ? ` (${formatINR(x.amount_paise)})` : ""}
            {!x.ok && !compact && (x.details?.length ?? 0) > 0 && <span className="mt-1 block text-xs text-muted-foreground">{(x.details ?? []).slice(0, 5).join(" · ")}{(x.details?.length ?? 0) > 5 ? ` and ${(x.details?.length ?? 0) - 5} more` : ""}</span>}
          </span>
          {!x.ok && !compact && isConnected(x.link) && <Link href={x.link} onClick={onLeave} className="shrink-0 text-[13px] font-medium text-brand hover:underline">Open</Link>}
        </li>
      ))}
    </ul>
  );
}

export function StepCheckLive({ onLeave }: { onLeave: () => void }) {
  const r = useReadiness();
  return (
    <Card>
      <CardHeader><div><CardTitle>Is the school ready?</CardTitle><CardDescription>These warn you; none of them stops the rollover.</CardDescription></div>
        {r.data && <Badge tone={r.data.all_ok ? "success" : "warning"}>{r.data.all_ok ? "All good" : "Needs a look"}</Badge>}</CardHeader>
      <ReadinessLive onLeave={onLeave} />
    </Card>
  );
}

/* ------------------------------------------------------------------ students */
const toUi = (d: ApiDecision): UiDecision => (d === "repeat" ? "stay" : d === "leave" ? "leave" : "promote");

function ClassBlock({ panel, plan, update, search }: { panel: ClassPanel; plan: RolloverPlan; update: LiveStepProps["update"]; search: string }) {
  const [open, setOpen] = React.useState(true);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const passes = !panel.destination;
  const defaultOf: ApiDecision = passes ? "passed_out" : "promote";
  const byId = React.useMemo(() => new Map((plan.decisions ?? []).map((d) => [d.student_id, d])), [plan.decisions]);
  const decisionOf = (s: StudentHint): ApiDecision => byId.get(s.student_id)?.decision ?? defaultOf;
  const shown = panel.students.filter((s) => !search || `${s.name} ${s.scholar_no}`.toLowerCase().includes(search.toLowerCase()));
  const count = (ui: UiDecision) => panel.students.filter((s) => toUi(decisionOf(s)) === ui).length;
  const [p, st, lv] = [count("promote"), count("stay"), count("leave")];
  const label = panel.class_label;

  const decide = (ids: string[], ui: UiDecision) => update((pl) => {
    const api: ApiDecision = ui === "promote" ? defaultOf : ui === "stay" ? "repeat" : "leave";
    const map = new Map((pl.decisions ?? []).map((d) => [d.student_id, d]));
    for (const id of ids) { if (api === defaultOf) map.delete(id); else map.set(id, { student_id: id, decision: api }); }
    return { ...pl, decisions: [...map.values()] };
  });
  const ids = shown.map((s) => s.student_id);
  const allPicked = ids.length > 0 && ids.every((i) => picked.has(i));
  const bulk = (ui: UiDecision) => { decide([...picked], ui); setPicked(new Set()); };

  return (
    <section aria-label={`Class ${label}`} className="rounded-[20px] bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} class ${label}`} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-fill hover:bg-separator">
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
        </button>
        <p className="text-[17px] font-bold">Class {label}</p>
        <p className="text-sm text-muted-foreground">{passes ? "Completes school" : `Moves to ${panel.destination}`}</p>
        <p className="ml-auto text-[13px] tabular-nums text-muted-foreground">
          {panel.students.length} students · <span className="text-success">{p} {passes ? "pass out" : "promote"}</span>
          {st > 0 && <> · <span className="text-warning">{st} stay</span></>}{lv > 0 && <> · <span className="text-danger">{lv} leaving</span></>}
        </p>
      </div>
      {open && (
        <div className="border-t border-border px-4 pb-2 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
              <Checkbox aria-label={`Select all in class ${label}`} checked={allPicked} onCheckedChange={(v) => setPicked(v === true ? new Set(ids) : new Set())} />
              {picked.size ? `${picked.size} selected` : "Select all"}
            </label>
            {picked.size > 0 && <>
              <Button size="sm" variant="secondary" onClick={() => bulk("promote")}>{passes ? "Pass out" : "Promote"} selected</Button>
              <Button size="sm" variant="secondary" onClick={() => bulk("stay")}>Mark selected as stay</Button>
              <Button size="sm" variant="secondary" onClick={() => bulk("leave")}>Mark selected as leaving</Button>
            </>}
          </div>
          {shown.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{panel.students.length ? "No students match your search." : "No active students in this class."}</p> : (
            <ul>
              {shown.map((s) => (
                <li key={s.student_id} className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Checkbox aria-label={`Select ${s.name}`} checked={picked.has(s.student_id)} className="mt-0.5" onCheckedChange={(v) => setPicked((cur) => { const n = new Set(cur); if (v === true) n.add(s.student_id); else n.delete(s.student_id); return n; })} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">{s.name}{s.below_pass && <Badge tone="danger">Below pass marks</Badge>}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
                        {s.roll_no != null && <span>Roll {s.roll_no}</span>}
                        <span>{s.result_percentage != null ? `Result ${s.result_percentage}%` : "No result"}</span>
                        <span>{s.attendance_percentage != null ? `Attendance ${s.attendance_percentage}%` : "No attendance"}</span>
                        <span className={s.fee_balance_paise > 0 ? "text-warning" : undefined}>{s.fee_balance_paise > 0 ? `Owes ${formatINR(s.fee_balance_paise)}` : "Fees paid"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="pl-8 sm:pl-0"><DecisionToggle name={s.name} value={toUi(decisionOf(s))} promoteLabel={passes ? "Pass out" : "Promote"} onChange={(d) => decide([s.student_id], d)} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function StepStudentsLive({ plan, update }: LiveStepProps) {
  const panels = usePanels();
  const [search, setSearch] = React.useState("");
  if (panels.isPending) return <LoadingBlock label="Loading students" />;
  if (panels.isError) return <ErrorBlock error={panels.error} onRetry={() => panels.refetch()} />;
  if (panels.data.length === 0) return <Card className="text-sm text-muted-foreground">There are no classes with students to move yet.</Card>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Everyone moves up by default and the last class passes out. Change only the exceptions: students who stay back or are leaving.</p>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
        <Input aria-label="Search students" className="rounded-full pl-10" placeholder="Search name or scholar no" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {panels.data.map((p) => <ClassBlock key={p.class_id} panel={p} plan={plan} update={update} search={search} />)}
    </div>
  );
}

/* ------------------------------------------------------------------ new year */
export function StepYearLive({ plan, update }: LiveStepProps) {
  const name = plan.new_year_name ?? "", from = plan.starts_on ?? "", to = plan.ends_on ?? "";
  const nameOk = !name || /^\d{4}-\d{2}$/.test(name);
  const dateBad = !!from && !!to && to <= from;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><div><CardTitle>The new year</CardTitle><CardDescription>Suggested from this year. Change the dates if your session starts on another day.</CardDescription></div></CardHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Year name" htmlFor="ro-year" hint={nameOk ? undefined : "Write it as 2027-28."}><Input id="ro-year" value={name} aria-invalid={!nameOk || undefined} onChange={(e) => update((p) => ({ ...p, new_year_name: e.target.value }))} /></Field>
          <Field label="Starts on" htmlFor="ro-from"><Input id="ro-from" type="date" value={from} onChange={(e) => update((p) => ({ ...p, starts_on: e.target.value || null }))} /></Field>
          <Field label="Ends on" htmlFor="ro-to" hint={dateBad ? "The end must be after the start." : undefined}><Input id="ro-to" type="date" value={to} aria-invalid={dateBad || undefined} onChange={(e) => update((p) => ({ ...p, ends_on: e.target.value || null }))} /></Field>
        </div>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Roll numbers</CardTitle><CardDescription>How students are numbered in their new class.</CardDescription></div></CardHeader>
        <ChoiceGroup label="Roll numbers" value={plan.roll_order} onChange={(v) => update((p) => ({ ...p, roll_order: v }))} options={[
          { value: "alphabetical", title: "Alphabetical", text: "Renumber by name in the new class." }, { value: "keep", title: "Keep as they are", text: "Students keep last year's roll number where possible." }]} />
      </Card>
      <p className="text-[13px] text-text-tertiary">New classes are created from the classes you have now: 8-A becomes 9-A. Seats are copied from this year.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ subjects and teachers */
export function StepTeachersLive({ plan, update }: LiveStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><div><CardTitle>Subjects</CardTitle><CardDescription>Each new class gets the subjects of the class it came from.</CardDescription></div></CardHeader>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Teachers</CardTitle><CardDescription>Who teaches the new classes.</CardDescription></div></CardHeader>
        <ChoiceGroup label="Teachers" value={plan.teachers} onChange={(v) => update((p) => ({ ...p, teachers: v }))} options={[
          { value: "same", title: "Same teachers", text: "Each teacher stays with the same grade and section." },
          { value: "move_up", title: "Move up with the class", text: "Teachers follow their students to the next grade." },
          { value: "empty", title: "Start empty", text: "Assign teachers yourself after Apply." }]} />
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Timetable</CardTitle><CardDescription>The weekly timetable for the new classes.</CardDescription></div></CardHeader>
        <ChoiceGroup label="Timetable" value={plan.timetable} onChange={(v) => update((p) => ({ ...p, timetable: v }))} options={[
          { value: "copy", title: "Copy last year's", text: "Start with the same periods and adjust later." }, { value: "empty", title: "Start empty", text: "Build it again from scratch." }]} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ fees */
export function StepFeesLive({ plan, update }: LiveStepProps) {
  const fees = plan.fees ?? { increase_percent: 0, round_to_paise: 0, cells: [], dues: "carry", carry_options: true };
  const set = (f: Partial<NonNullable<RolloverPlan["fees"]>>) => update((p) => ({ ...p, fees: { ...fees, ...f } }));
  const inv = fees.first_invoice;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><div><CardTitle>Fee increase</CardTitle><CardDescription>New fees start from last year&apos;s amounts for each class.</CardDescription></div></CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Increase (percent)" htmlFor="ro-inc"><Input id="ro-inc" inputMode="numeric" value={String(fees.increase_percent ?? 0)} onChange={(e) => set({ increase_percent: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })} /></Field>
          <Field label="Round amounts to" htmlFor="ro-round"><NativeSelect id="ro-round" value={String(fees.round_to_paise ?? 0)} onChange={(e) => set({ round_to_paise: Number(e.target.value) })}><option value="0">No rounding</option><option value="10000">Nearest Rs 100</option><option value="100000">Nearest Rs 1,000</option></NativeSelect></Field>
        </div>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Unpaid fees</CardTitle><CardDescription>For students who continue. Dues of students who leave or pass out stay on their old invoices.</CardDescription></div></CardHeader>
        <ChoiceGroup label="Unpaid fees" value={fees.dues ?? "carry"} onChange={(v) => set({ dues: v })} options={[
          { value: "carry", title: "Carry forward", text: "Unpaid amounts move to the new year." }, { value: "write_off", title: "Write off", text: "Unpaid amounts are cleared. Needs a reason." }]} />
        {fees.dues === "write_off" && <div className="mt-4"><Field label="Reason for writing off" htmlFor="ro-reason"><Textarea id="ro-reason" value={fees.write_off_reason ?? ""} onChange={(e) => set({ write_off_reason: e.target.value })} /></Field></div>}
      </Card>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-fill px-4 py-3">
          <Label htmlFor="ro-opts">Carry optional fees (transport and similar) for continuing students</Label>
          <Switch id="ro-opts" checked={fees.carry_options ?? true} onCheckedChange={(on) => set({ carry_options: on })} />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-fill px-4 py-3">
          <Label htmlFor="ro-inv">Create the first invoices now</Label>
          <Switch id="ro-inv" checked={!!inv} onCheckedChange={(on) => set({ first_invoice: on ? { period_label: "Term 1", due_on: plan.starts_on ?? "", frequencies: ["term", "yearly", "once"] } : undefined })} />
        </div>
        {inv && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice name" htmlFor="ro-pl"><Input id="ro-pl" value={inv.period_label ?? ""} onChange={(e) => set({ first_invoice: { ...inv, period_label: e.target.value } })} /></Field>
            <Field label="Due on" htmlFor="ro-due" hint={!inv.due_on ? "Choose a due date." : undefined}><Input id="ro-due" type="date" value={inv.due_on ?? ""} onChange={(e) => set({ first_invoice: { ...inv, due_on: e.target.value } })} /></Field>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ summary and review */
function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return <div className="flex items-baseline justify-between gap-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className={`font-bold tabular-nums ${tone ?? ""}`}>{value}</dd></div>;
}
export function SideSummaryLive({ p, fromLabel }: { p: RolloverPreview | undefined; fromLabel: string }) {
  return (
    <Card className="flex flex-col gap-4 p-5" aria-label="Summary">
      <div><p className="text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Summary</p><p className="mt-1 font-bold">{fromLabel}{p ? ` to ${p.to_year}` : ""}</p></div>
      {!p ? <p className="text-sm text-muted-foreground">Numbers appear as you make choices.</p> : (
        <>
          <dl className="flex flex-col gap-2.5">
            <Row label="Moving up" value={p.promoted} tone="text-success" /><Row label="Staying" value={p.staying} tone={p.staying ? "text-warning" : undefined} />
            <Row label="Passing out" value={p.passed_out} /><Row label="Leaving" value={p.leaving} tone={p.leaving ? "text-danger" : undefined} />
          </dl>
          <hr className="border-border" />
          <dl className="flex flex-col gap-2.5">
            <Row label="New classes" value={p.new_classes.length} /><Row label="Teacher slots" value={`${p.teacher_slots_filled} of ${p.teacher_slots}`} />
            <Row label="Dues moving on" value={p.dues.total_paise ? formatINR(p.dues.total_paise) : "None"} /><Row label="Parents notified" value={p.parents_notified} />
          </dl>
        </>
      )}
    </Card>
  );
}

export function StepReviewLive({ preview, loading, error, onRetry, ack, setAck, applying, onApply }: {
  preview: RolloverPreview | undefined; loading: boolean; error: unknown; onRetry: () => void; ack: boolean; setAck: (b: boolean) => void; applying: boolean; onApply: () => void;
}) {
  const can = useCan();
  if (loading && !preview) return <LoadingBlock label="Working out what will happen" />;
  if (error && !preview) return <ErrorBlock error={error} onRetry={onRetry} />;
  if (!preview) return null;
  const p = preview;
  const blocked = !p.can_apply || p.problems.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Moving up" value={p.promoted} /><StatCard label="Staying" value={p.staying} /><StatCard label="Leaving" value={p.leaving} /><StatCard label="Passing out" value={p.passed_out} />
      </div>
      {p.problems.length > 0 && (
        <Card className="flex flex-col gap-2 bg-danger/10">
          <p className="text-sm font-bold text-danger">Fix these before applying</p>
          <ul className="flex flex-col gap-1.5 text-sm">{p.problems.map((x) => <li key={x.code + x.message} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />{x.message}</li>)}</ul>
        </Card>
      )}
      <Card>
        <CardHeader><div><CardTitle>{p.from_year} to {p.to_year}</CardTitle><CardDescription>{p.starts_on && p.ends_on ? `${formatDateOn(p.starts_on)} to ${formatDateOn(p.ends_on)}` : "Dates are set when applied."}</CardDescription></div></CardHeader>
        <ul className="text-sm">
          {([
            ["New classes", p.new_classes.length], ["Teacher slots filled", `${p.teacher_slots_filled} of ${p.teacher_slots}`],
            ["Fees per year, all classes", formatINR(p.fee_total_paise)],
            [p.dues.mode === "write_off" ? "Unpaid fees written off" : "Unpaid fees carried forward", p.dues.students ? `${formatINR(p.dues.total_paise)} (${p.dues.students} students)` : "None"],
            ["First invoices", p.first_invoices ? "Created now" : "Later"], ["Parents who will get a notification", p.parents_notified],
          ] as [string, React.ReactNode][]).map(([k, v]) => <li key={k} className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 first:border-t-0 first:pt-0"><span className="text-muted-foreground">{k}</span><b className="text-right tabular-nums">{v}</b></li>)}
        </ul>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>New classes</CardTitle><CardDescription>Where students will be after Apply.</CardDescription></div></CardHeader>
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {p.new_classes.map((c) => (
            <li key={c.label} className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 text-sm">
              <span><b>Class {c.label}</b> {!c.exists && <Badge className="ml-1">New</Badge>}<span className="block text-xs text-muted-foreground">{c.from_classes.length ? `From ${c.from_classes.join(", ")}` : "Empty, for new admissions"}</span></span>
              <span className="tabular-nums text-muted-foreground">{c.students} students</span>
            </li>
          ))}
        </ul>
      </Card>
      {p.warnings.length > 0 && (
        <Card><ul className="flex flex-col gap-2">{p.warnings.map((w) => <li key={w} className="flex items-start gap-3 rounded-xl bg-fill px-4 py-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />{w}</li>)}</ul></Card>
      )}
      <Card className="flex flex-col gap-4">
        <label htmlFor="ro-ack" className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox id="ro-ack" className="mt-0.5" checked={ack} onCheckedChange={(v) => setAck(v === true)} />
          <span><b>I have checked this.</b> After Apply, {p.from_year} is closed and cannot be reopened. All of it happens together or not at all.</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand" size="lg" loading={applying} disabled={!ack || blocked || !can("academic.manage")} onClick={onApply}>Apply rollover</Button>
        </div>
      </Card>
    </div>
  );
}
