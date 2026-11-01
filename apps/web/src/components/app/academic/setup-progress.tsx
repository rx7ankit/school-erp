"use client";
import { BookOpen, Check, Layers, Users, type LucideIcon } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAcademic } from "@/lib/academic-setup";
import { classSlots, useAssignments } from "@/lib/assignments";

type Status = "todo" | "doing" | "done";
const STATUS_LABEL: Record<Status, string> = { todo: "To do", doing: "In progress", done: "Done" };

function Step({ n, icon: Icon, title, detail, status, tab, onGo }: { n: number; icon: LucideIcon; title: string; detail: string; status: Status; tab: string; onGo: (t: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onGo(tab)} className="flex w-full items-start gap-3 rounded-2xl bg-fill p-4 text-left hover:bg-separator" aria-label={`Step ${n}: ${title}. ${detail}. ${STATUS_LABEL[status]}. Open`}>
        <span className={`grid size-8 shrink-0 place-items-center rounded-full ${status === "done" ? "bg-success text-white" : "bg-card text-muted-foreground"}`}>{status === "done" ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}</span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">{n}. {title}</span>
          <span className="block text-[13px] text-muted-foreground" data-testid={`step-${tab}`}>{detail}</span>
          <span className={`mt-1 block text-xs font-medium ${status === "done" ? "text-success" : status === "doing" ? "text-warning" : "text-text-tertiary"}`}>{STATUS_LABEL[status]}</span>
        </span>
      </button>
    </li>
  );
}

/** Where the school is in the setup order: classes, subjects, teachers. */
export function SetupProgress({ onGo }: { onGo: (tab: string) => void }) {
  const { classes, subjects, classSubjects } = useAcademic();
  useAssignments();
  const assigned = subjects.filter((s) => classes.some((c) => (classSubjects[c.id] ?? []).includes(s.id))).length;
  let filled = 0, total = 0;
  for (const c of classes) {
    const names = subjects.filter((s) => (classSubjects[c.id] ?? []).includes(s.id)).map((s) => s.name);
    const k = classSlots(c.id, names); filled += k.filled; total += k.total;
  }
  const st = (done: boolean, started: boolean): Status => (done ? "done" : started ? "doing" : "todo");
  return (
    <Card>
      <div className="mb-4"><CardTitle>Setup progress</CardTitle><CardDescription>Do these in order. Each step feeds the next.</CardDescription></div>
      <ol className="grid gap-3 md:grid-cols-3">
        <Step n={1} icon={Layers} tab="years" title="Classes" detail={`${classes.length} ${classes.length === 1 ? "section" : "sections"}`} status={st(classes.length > 0, false)} onGo={onGo} />
        <Step n={2} icon={BookOpen} tab="subjects" title="Subjects" detail={`${assigned} ${assigned === 1 ? "subject" : "subjects"} assigned`} status={st(subjects.length > 0 && assigned === subjects.length, assigned > 0)} onGo={onGo} />
        <Step n={3} icon={Users} tab="teachers" title="Teachers" detail={`${filled} of ${total} slots filled`} status={st(total > 0 && filled === total, filled > 0)} onGo={onGo} />
      </ol>
    </Card>
  );
}
