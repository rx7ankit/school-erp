"use client";
import * as React from "react";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { classLabel, useAcademic, type Exam } from "@/lib/academic-setup";
import { formatDateOn } from "@/lib/time";
import { ExamDialog } from "./exam-dialog";

export function ExamsTab() {
  const { exams, subjects } = useAcademic();
  const [dlg, setDlg] = React.useState<Exam | "new" | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><Button variant="accent" onClick={() => setDlg("new")}><Plus /> New exam</Button></div>
      {exams.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No exams" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {exams.map((e) => {
            const ids = [...new Set(e.subjects.map((s) => s.subjectId))];
            return (
              <Card key={e.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-[17px] font-bold">{e.name}</h3><p className="text-[13px] tabular-nums text-muted-foreground">{e.term} · {formatDateOn(e.fromOn, "short")} – {formatDateOn(e.toOn)}</p></div>
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${e.name}`} onClick={() => setDlg(e)}><Pencil /></Button>
                </div>
                <div className="flex flex-wrap gap-1.5">{e.classIds.map((c) => <Badge key={c}>{classLabel(c)}</Badge>)}</div>
                <p className="text-sm text-muted-foreground">
                  {ids.map((id) => { const m = e.subjects.find((s) => s.subjectId === id)!; return `${subjects.find((s) => s.id === id)?.name ?? "Removed"} ${m.max}/${m.pass}`; }).join(" · ") || "No subjects"}
                </p>
              </Card>
            );
          })}
        </div>
      )}
      {dlg && <ExamDialog key={dlg === "new" ? "new" : dlg.id} exam={dlg} onClose={() => setDlg(null)} />}
    </div>
  );
}
