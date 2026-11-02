"use client";
import * as React from "react";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSaveDay, useSheet, type RecordIn, type SheetStudent } from "@/lib/api/hooks/attendance";
import { errorText } from "@/lib/api/hooks/staff";
import { formatDateOn, formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";

type Half = "present" | "absent" | "leave";
type Mark = { first: Half; second: Half; late: boolean };
type Kind = "present" | "absent" | "half" | "leave";
const kindOf = (m: Mark): Kind => (m.first === m.second ? m.first : "half");
const OPTIONS: { v: Kind; label: string }[] = [{ v: "present", label: "Present" }, { v: "absent", label: "Absent" }, { v: "half", label: "Half day" }, { v: "leave", label: "Leave" }];
const fromKind = (k: Kind, late = false): Mark => (k === "half" ? { first: "present", second: "absent", late: false } : { first: k, second: k, late: k === "present" && late });
const HALF: { v: Half; label: string }[] = [{ v: "present", label: "In" }, { v: "absent", label: "Out" }, { v: "leave", label: "Leave" }];
const tone = { present: "success", absent: "danger", half: "warning", leave: "neutral" } as const;

const fromRow = (s: SheetStudent): Mark => ({ first: s.first_half, second: s.second_half, late: s.late });
const same = (a: Mark, b: Mark) => a.first === b.first && a.second === b.second && a.late === b.late;

/** The class sheet for one day. Only the class teacher (or admin) can change it; everyone else with access just reads. */
export function AttendanceSheet({ classId, day, setDay, today }: { classId: string; day: string; setDay: (d: string) => void; today: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Day (IST)" type="date" className="w-44" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
        {day !== today && <Button variant="ghost" size="sm" onClick={() => setDay(today)}>Today</Button>}
      </div>
      {/* Keyed, so edits and messages start fresh for every class and day. */}
      <SheetBody key={`${classId}-${day}`} classId={classId} day={day} today={today} />
    </div>
  );
}

function SheetBody({ classId, day, today }: { classId: string; day: string; today: string }) {
  const q = useSheet(classId, day);
  const save = useSaveDay();
  const sheet = q.data;
  const [edits, setEdits] = React.useState<Record<string, Mark>>({});
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const rows = React.useMemo(() => sheet?.students ?? [], [sheet]);
  const get = (s: SheetStudent) => edits[s.student_id] ?? fromRow(s);
  const set = (s: SheetStudent, m: Mark) => { setErr(null); setEdits((x) => ({ ...x, [s.student_id]: m })); };
  const changed = rows.filter((s) => edits[s.student_id] && !same(edits[s.student_id], fromRow(s)));
  const counts = OPTIONS.map((o) => ({ ...o, n: rows.filter((s) => kindOf(get(s)) === o.v).length }));
  const canMark = !!sheet?.can_mark;
  // A day nobody saved has only suggestions on the sheet. Someone who cannot mark it should not read them as attendance.
  const hideMarks = !!sheet && !sheet.marked && !canMark;
  const dirty = !!sheet && (sheet.marked ? changed.length > 0 : true);

  function onSave() {
    if (!sheet) return;
    const pick = sheet.marked ? changed : rows;
    const records: RecordIn[] = pick.map((s) => { const m = get(s); return { student_id: s.student_id, first_half: m.first, second_half: m.second, late: m.late && m.first === "present", note: s.note }; });
    setErr(null);
    save.mutate({ classId, day, records }, {
      onSuccess: () => { setEdits({}); setSavedAt(new Date().toISOString()); toast.success(`Attendance saved for ${sheet.class_label}`, { description: formatDateOn(day, "weekday") }); },
      onError: (e) => setErr(errorText(e)),
    });
  }

  let why = "";
  if (sheet && !canMark) why = sheet.holiday ? `${formatDateOn(day)} is a holiday: ${sheet.holiday}.` : day > today ? "Attendance cannot be marked for a future date." : "You can view this class. Only its class teacher can mark or change attendance, and older days need the admin.";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {sheet?.marked && <span className="text-sm text-muted-foreground">Saved{sheet.marked_by ? ` by ${sheet.marked_by}` : ""}{sheet.marked_at ? ` · ${formatIST(sheet.marked_at)} IST` : ""}</span>}
        {sheet && !sheet.marked && canMark && <Badge tone="warning">Not saved yet</Badge>}
      </div>

      {q.isPending ? <LoadingBlock label="Loading the class sheet" /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          {why && <div role="status" className="flex items-start gap-2 rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0" /> {why}</div>}
          {rows.length === 0 ? <EmptyState icon={Check} title="No students in this class" text="Add students to the class and they will show up here." /> : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {hideMarks ? <span className="text-sm text-muted-foreground">Attendance was not saved for this day.</span> : counts.map((c) => <Badge key={c.v} tone={tone[c.v]}>{c.n} {c.label}</Badge>)}
                {canMark && <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEdits(Object.fromEntries(rows.map((s) => [s.student_id, fromKind("present")])))}>Mark all present</Button>}
              </div>
              <Card className="p-2 sm:p-3">
                <ul>
                  {rows.map((s) => {
                    const m = get(s), k = kindOf(m);
                    return (
                      <li key={s.student_id} className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3 hover:bg-card-hover">
                        <span className="w-6 text-sm tabular-nums text-text-tertiary">{s.roll_no ?? ""}</span>
                        <Avatar name={s.name} />
                        <span className="flex min-w-0 flex-1 basis-40 items-center gap-2">
                          <span className="min-w-0"><span className="block truncate font-medium">{s.name}</span><span className="block text-xs text-text-tertiary">Scholar no. {s.scholar_no}</span></span>
                          {s.leave_id && !s.saved && <Badge>Approved leave</Badge>}
                        </span>
                        {k === "half" && canMark && (
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {([["first", "Morning"], ["second", "Afternoon"]] as const).map(([half, label]) => (
                              <div key={half} role="radiogroup" aria-label={`${label} for ${s.name}`} className="inline-flex items-center gap-1.5">
                                {label}
                                {HALF.map((h) => (
                                  <button key={h.v} type="button" role="radio" aria-checked={m[half] === h.v} onClick={() => set(s, { ...m, [half]: h.v })}
                                    className={cn("h-7 rounded-full bg-fill px-2.5 font-medium", m[half] === h.v && "bg-solid text-on-solid")}>{h.label}</button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                        {k === "half" && !canMark && !hideMarks && <span className="text-xs text-muted-foreground">Morning: {m.first}, afternoon: {m.second}</span>}
                        {k === "present" && m.late && !canMark && !hideMarks && <Badge tone="warning">Late</Badge>}
                        {canMark ? (
                          <>
                            {k === "present" && (
                              <button type="button" aria-pressed={m.late} onClick={() => set(s, { ...m, late: !m.late })}
                                className={cn("h-7 rounded-full bg-fill px-3 text-xs font-medium text-muted-foreground", m.late && "bg-warning/15 text-warning")}>Late</button>
                            )}
                            <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="inline-flex gap-0.5 rounded-full bg-fill p-[3px]">
                              {OPTIONS.map((o) => (
                                <button key={o.v} type="button" role="radio" aria-checked={k === o.v} onClick={() => k !== o.v && set(s, fromKind(o.v))}
                                  className={cn("h-8 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors", k === o.v && (o.v === "present" ? "bg-brand text-brand-foreground" : "bg-solid text-on-solid"))}>{o.label}</button>
                              ))}
                            </div>
                          </>
                        ) : (k !== "half" && !hideMarks && <Badge tone={tone[k]}>{OPTIONS.find((o) => o.v === k)?.label}</Badge>)}
                      </li>
                    );
                  })}
                </ul>
              </Card>
              {canMark && (
                <div className="flex flex-wrap items-center justify-end gap-4">
                  {err && <p role="alert" className="mr-auto text-sm text-danger">{err}</p>}
                  {savedAt && !err && !dirty && <span className="flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> Saved at {formatIST(savedAt, "time")} IST</span>}
                  {sheet?.marked && changed.length > 0 && <span className="text-sm text-muted-foreground">{changed.length} {changed.length === 1 ? "change" : "changes"} to save</span>}
                  <Button variant="brand" size="lg" loading={save.isPending} disabled={!dirty} onClick={onSave}>{sheet?.marked ? "Save changes" : "Save attendance"}</Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
