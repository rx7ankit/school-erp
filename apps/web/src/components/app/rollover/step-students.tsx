"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getAcademic } from "@/lib/academic-setup";
import { CLASSES, attendanceStats } from "@/lib/mock";
import { invoicesOf, owedOf } from "@/lib/fees-setup";
import { resultsFor } from "@/lib/parent-data";
import { activeStudents, approvedAdmissions, decisionOf, type Decision, type Dest } from "@/lib/rollover";
import { ClassPanel } from "./class-panel";
import type { Hints } from "./student-row";
import type { StepProps } from "./step-props";

function buildHints(): Map<string, Hints> {
  const pass = getAcademic().scheme.passPercent;
  return new Map(activeStudents().map((s) => {
    const pct = resultsFor(s)[0].pct;
    return [s.id, { resultPct: pct, attendancePct: attendanceStats(s.id).pct, balancePaise: invoicesOf(s.id).reduce((a, i) => a + owedOf(i), 0), belowPass: pct < pass }];
  }));
}

export function StepStudents({ draft, update }: StepProps) {
  const [q, setQ] = React.useState("");
  const [closed, setClosed] = React.useState<Set<string>>(new Set());
  const hints = React.useMemo(() => buildHints(), []);
  const students = activeStudents();
  const classes = CLASSES.filter((c) => !draft.focusClassId || c.id === draft.focusClassId);
  const query = q.trim().toLowerCase();
  const decide = (ids: string[], d: Decision) => update((cur) => ({ ...cur, decisions: { ...cur.decisions, ...Object.fromEntries(ids.map((id) => [id, d])) } }));
  const setDest = (id: string, dest: Dest) => update((cur) => ({ ...cur, dest: { ...cur.dest, [id]: dest } }));
  const total = (d: Decision) => students.filter((s) => decisionOf(draft, s.id) === d).length;
  const admissions = approvedAdmissions();
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
            <Input aria-label="Search students" placeholder="Search" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setClosed(new Set())}>Expand all</Button>
            <Button variant="secondary" size="sm" onClick={() => setClosed(new Set(CLASSES.map((c) => c.id)))}>Collapse all</Button>
            <Button variant="secondary" size="sm" onClick={() => decide(students.map((s) => s.id), "promote")}>Reset</Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <b className="text-foreground tabular-nums">{total("promote")}</b> move up · <b className="text-foreground tabular-nums">{total("stay")}</b> stay · <b className="text-foreground tabular-nums">{total("leave")}</b> leaving
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fill px-4 py-3 text-sm">
          <label htmlFor="keep-order" className="cursor-pointer font-medium">Keep roll order</label>
          <Switch id="keep-order" checked={draft.keepOrder} onCheckedChange={(v) => update((cur) => ({ ...cur, keepOrder: v }))} />
        </div>
        {admissions > 0 && <p className="text-[13px] text-muted-foreground">{admissions} approved {admissions === 1 ? "admission" : "admissions"} waiting</p>}
      </Card>
      {draft.focusClassId && <Button variant="secondary" size="sm" className="self-start" onClick={() => update((cur) => ({ ...cur, focusClassId: undefined }))}>All classes</Button>}
      {classes.map((c) => {
        const all = students.filter((s) => s.classId === c.id);
        const shown = query ? all.filter((s) => `${s.name} ${s.scholarNo}`.toLowerCase().includes(query)) : all;
        if (query && !shown.length) return null;
        return (
          <ClassPanel key={c.id} cls={c} all={all} students={shown} hints={hints} draft={draft} open={!!query || !closed.has(c.id)}
            onToggle={() => setClosed((cur) => { const n = new Set(cur); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
            onDecide={decide} onDest={(dest) => setDest(c.id, dest)} />
        );
      })}
    </div>
  );
}
