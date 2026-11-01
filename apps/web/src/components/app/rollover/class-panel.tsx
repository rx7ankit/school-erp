"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { ClassRow, Student } from "@/lib/mock";
import { decisionOf, destOf, type Decision, type Dest } from "@/lib/rollover";
import type { RolloverDraft } from "@/lib/rollover";
import { cn } from "@/lib/utils";
import { DestPicker } from "./dest-picker";
import { StudentRow, type Hints } from "./student-row";

/** One class: where it goes, the bulk actions and every student with their decision. */
export function ClassPanel({ cls, students, all, hints, draft, open, onToggle, onDecide, onDest }: {
  cls: ClassRow; students: Student[]; all: Student[]; hints: Map<string, Hints>; draft: RolloverDraft; open: boolean;
  onToggle: () => void; onDecide: (ids: string[], d: Decision) => void; onDest: (d: Dest) => void;
}) {
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const dest = destOf(draft, cls);
  const promoteLabel = dest ? "Promote" : "Pass out";
  const count = (d: Decision) => all.filter((s) => decisionOf(draft, s.id) === d).length;
  const [p, st, lv] = [count("promote"), count("stay"), count("leave")];
  const ids = students.map((s) => s.id);
  const allPicked = ids.length > 0 && ids.every((id) => picked.has(id));
  const bulk = (d: Decision) => { onDecide([...picked], d); setPicked(new Set()); };
  const label = `${cls.grade}-${cls.section}`;
  return (
    <section aria-label={`Class ${label}`} className="rounded-[20px] bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5">
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} class ${label}`}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-fill hover:bg-separator">
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
        </button>
        <DestPicker cls={cls} dest={dest} onChange={onDest} />
        <p className="ml-auto text-[13px] tabular-nums text-muted-foreground">
          {all.length} students · <span className="text-success">{p} {dest ? "promote" : "pass out"}</span>
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
            {picked.size > 0 && (
              <>
                <Button size="sm" variant="secondary" onClick={() => bulk("promote")}>{promoteLabel} selected</Button>
                <Button size="sm" variant="secondary" onClick={() => bulk("stay")}>Mark selected as stay</Button>
                <Button size="sm" variant="secondary" onClick={() => bulk("leave")}>Mark selected as leaving</Button>
              </>
            )}
          </div>
          {students.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No students match your search.</p> : (
            <ul>
              {students.map((s) => (
                <StudentRow key={s.id} student={s} hints={hints.get(s.id)!} decision={decisionOf(draft, s.id)} promoteLabel={promoteLabel}
                  selected={picked.has(s.id)} onSelect={(on) => setPicked((cur) => { const n = new Set(cur); if (on) n.add(s.id); else n.delete(s.id); return n; })}
                  onDecide={(d) => onDecide([s.id], d)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
