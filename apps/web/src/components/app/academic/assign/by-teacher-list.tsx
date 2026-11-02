"use client";
import * as React from "react";
import { Search, Users } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { staffHint } from "@/lib/assignments";
import { STAFF, className } from "@/lib/mock";

/** The same assignments, read per teacher: "what does Rajiv teach". */
export function ByTeacherList() {
  const [q, setQ] = React.useState("");
  const list = STAFF.filter((s) => `${s.name} ${s.designation} ${s.department}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
        <Input aria-label="Search teachers" placeholder="Search" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.length === 0 ? <EmptyState icon={Users} title="No matches" /> : (
        <Card>
          <ul>
            {list.map((s) => {
              const ctOf = s.classes.filter((e) => e.role === "class_teacher");
              return (
                <li key={s.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
                  <div className="w-48 shrink-0"><p className="font-bold">{s.name}</p><p className="text-xs text-muted-foreground">{staffHint(s)}</p></div>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    {s.classes.length === 0 && <span className="text-sm text-muted-foreground">Not assigned to any class</span>}
                    {[...s.classes].sort((a, b) => className(a.classId).localeCompare(className(b.classId), undefined, { numeric: true })).map((e, i) => (
                      <span key={`${e.classId}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-sm">
                        <span className="font-medium">{className(e.classId)}</span>
                        {e.subject && <span className="text-muted-foreground">{e.subject}</span>}
                        {e.role === "class_teacher" && <span className="text-xs font-medium text-brand">Class teacher</span>}
                      </span>
                    ))}
                  </div>
                  {ctOf.length > 1 && <Badge tone="warning">Class teacher of {ctOf.length} classes</Badge>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
