"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { useSession } from "@/components/session-provider";
import { CLASSES, STUDENTS, className } from "@/lib/mock";
import { classIdsFor, hasAccess } from "@/lib/permissions";
import { formatDateOn, formatIST, nowUTC } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";
import { cn } from "@/lib/utils";

type Status = "present" | "absent" | "late" | "leave";
const OPTIONS: { v: Status; label: string }[] = [
  { v: "present", label: "Present" }, { v: "absent", label: "Absent" }, { v: "late", label: "Late" }, { v: "leave", label: "Leave" },
];

export default function AttendancePage() {
  const { user } = useSession();
  const mine = user ? classIdsFor(user, "class_teacher", CLASSES.map((c) => c.id)) : [];
  const [classId, setClassId] = React.useState(mine[0] ?? "");
  const [marks, setMarks] = React.useState<Record<string, Status>>({});
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const today = useTodayIST();

  if (!hasAccess(user, "class_teacher")) return <NoAccess need="class teacher access" />;
  const students = STUDENTS.filter((s) => s.classId === classId);
  const get = (id: string): Status => marks[id] ?? "present";
  const counts = OPTIONS.map((o) => ({ ...o, n: students.filter((s) => get(s.id) === o.v).length }));

  return (
    <>
      <PageHeader eyebrow="Class teacher" title="Attendance." dim={today ? formatDateOn(today, "weekday") : ""}
        actions={mine.length > 1 ? (
          <NativeSelect aria-label="Class" className="w-40" value={classId} onChange={(e) => { setClassId(e.target.value); setSavedAt(null); }}>
            {mine.map((id) => <option key={id} value={id}>Class {className(id)}</option>)}
          </NativeSelect>
        ) : <Badge tone="brand">Class {className(classId)}</Badge>} />

      <div className="flex flex-wrap items-center gap-2">
        {counts.map((c) => <Badge key={c.v} tone={c.v === "present" ? "success" : c.v === "absent" ? "danger" : c.v === "late" ? "warning" : "neutral"}>{c.n} {c.label}</Badge>)}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMarks({})}>Mark all present</Button>
      </div>

      <Card className="p-2 sm:p-3">
        <ul>
          {students.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3 hover:bg-card-hover">
              <span className="w-6 text-sm tabular-nums text-text-tertiary">{s.rollNo}</span>
              <Avatar name={s.name} />
              <span className="min-w-0 flex-1 basis-40 truncate font-medium">{s.name}</span>
              <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="inline-flex gap-0.5 rounded-full bg-fill p-[3px]">
                {OPTIONS.map((o) => (
                  <button
                    key={o.v} type="button" role="radio" aria-checked={get(s.id) === o.v}
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: o.v }))}
                    className={cn("h-8 rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors",
                      get(s.id) === o.v && (o.v === "present" ? "bg-brand text-brand-foreground" : "bg-solid text-on-solid"))}
                  >{o.label}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-4">
        {savedAt && <span className="flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> Saved at {formatIST(savedAt, "time")} IST</span>}
        <Button variant="brand" size="lg" onClick={() => { const at = nowUTC(); setSavedAt(at); toast.success(`Attendance saved for Class ${className(classId)}`); }}>Save attendance</Button>
      </div>
    </>
  );
}
