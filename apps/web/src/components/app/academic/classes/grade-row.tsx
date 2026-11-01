"use client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { activeStudentsIn, type SetupClass } from "@/lib/academic-setup";
import { className } from "@/lib/mock";

/** One grade (or custom class) with its sections as chips. Grades without sections show as Not used. */
export function GradeRow({ title, sub, sections, onAdd, onEdit, onDelete, readOnly }: {
  title: string; sub?: string; sections: SetupClass[];
  onAdd: () => void; onEdit: (c: SetupClass) => void; onDelete: (c: SetupClass) => void; readOnly?: boolean;
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
        {sections.map((c) => {
          const n = activeStudentsIn(c.id).length;
          return (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-fill py-1 pl-3.5 pr-1 text-sm" data-testid={`chip-${c.id}`}>
              <span className="font-medium">{className(c.id)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{n}/{c.capacity}</span>
              {n >= c.capacity && <span className="text-xs text-warning">Full</span>}
              {!readOnly && (
                <>
                  <Button size="icon-sm" variant="ghost" className="size-7" aria-label={`Edit class ${className(c.id)}`} onClick={() => onEdit(c)}><Pencil className="size-3.5" /></Button>
                  <Button size="icon-sm" variant="ghost" className="size-7" aria-label={`Delete class ${className(c.id)}`} onClick={() => onDelete(c)}><Trash2 className="size-3.5" /></Button>
                </>
              )}
            </span>
          );
        })}
      </div>
      {!readOnly && (used
        ? <Button size="sm" variant="secondary" onClick={onAdd} aria-label={`Add section to ${title}`}><Plus /> Add section</Button>
        : <Button size="sm" variant="brand" onClick={onAdd} aria-label={`Use ${title}`}><Plus /> Use this grade</Button>)}
    </li>
  );
}
