"use client";
import * as React from "react";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import type { ThreadInfo } from "@/lib/messaging";
import { STUDENTS, className } from "@/lib/mock";

/** Pick a student from the teacher's classes to write to their parent. Opens the (possibly empty) thread. */
export function NewMessageDialog({ open, onOpenChange, threads, onStart }: {
  open: boolean; onOpenChange: (o: boolean) => void; threads: (ThreadInfo & { classId: string })[]; onStart: (key: string) => void;
}) {
  const [picked, setPicked] = React.useState("");
  const key = threads.some((t) => t.key === picked) ? picked : threads[0]?.key ?? "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New message</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (key) { onStart(key); onOpenChange(false); } }} className="flex flex-col gap-4">
          <Field label="Student" htmlFor="nm-student">
            <NativeSelect id="nm-student" value={key} onChange={(e) => setPicked(e.target.value)}>
              {threads.map((t) => { const s = STUDENTS.find((x) => x.id === t.studentId); return <option key={t.key} value={t.key}>{s?.name} · {className(t.classId)} · {t.subject}</option>; })}
            </NativeSelect>
          </Field>
          <DialogFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="brand" disabled={!key}>Start</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
