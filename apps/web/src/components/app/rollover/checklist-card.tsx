"use client";
import Link from "next/link";
import { Circle } from "lucide-react";
import { useCan } from "@/components/app/can";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssignments } from "@/lib/assignments";
import { useFeesStore } from "@/lib/fees-setup";
import { checklistRows, useChecklistVersion, useLastResult } from "@/lib/rollover";

/** Compact "Year-end checklist" for the academic team. Hides itself when every item is done. */
export function ChecklistCard() {
  const can = useCan();
  const result = useLastResult();
  useChecklistVersion(); useAssignments(); useFeesStore();
  if (!result || !can("academic.manage")) return null;
  const rows = checklistRows(result);
  const open = rows.filter((r) => !r.done);
  if (!open.length) return null;
  const done = rows.length - open.length;
  return (
    <Card aria-label="Year-end checklist">
      <CardHeader>
        <div><CardTitle>Year-end checklist</CardTitle><p className="mt-0.5 text-[13px] text-muted-foreground">{result.toLabel} · {done} of {rows.length} done</p></div>
        <Button asChild variant="link" size="sm"><Link href="/promotion">Open</Link></Button>
      </CardHeader>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-separator" role="progressbar" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={done} aria-label="Checklist progress">
        <div className="h-full rounded-full bg-brand" style={{ width: `${(done / rows.length) * 100}%` }} />
      </div>
      <ul className="flex flex-col">
        {open.map((r) => (
          <li key={r.id} className="border-t border-border first:border-t-0">
            <Link href={r.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm hover:bg-card-hover"><Circle className="size-4 shrink-0 text-text-tertiary" aria-hidden />{r.text}</Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
