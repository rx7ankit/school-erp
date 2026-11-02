"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { Field } from "@/components/app/field";
import { Stars } from "@/components/app/charts";
import { useCan } from "@/components/app/can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CLASSES, className } from "@/lib/mock";
import { FEEDBACK_REQUESTS, requestSummary, targetsFor, type FeedbackRequest } from "@/lib/feedback-mock";
import { formatDateOn } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { notify } from "@/lib/notifications";
import { STUDENTS } from "@/lib/mock";
import { useTodayIST } from "@/lib/use-today";
import { isLive } from "@/lib/api/config";
import { FeedbackLive } from "@/components/app/feedback-live";

export default function FeedbackPage() {
  return isLive ? <FeedbackLive /> : <FeedbackDemo />;
}

function FeedbackDemo() {
  const can = useCan();
  const [rows, setRows] = React.useState<FeedbackRequest[]>(FEEDBACK_REQUESTS);
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>(CLASSES.map((c) => c.id));
  const { run, is } = usePending(900);
  const today = useTodayIST();
  if (!can("academic.manage")) return <NoAccess need="the Academic permission" />;

  function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!picked.length) { toast.error("Choose at least one class"); return; }
    const req: FeedbackRequest = { id: crypto.randomUUID(), title: String(f.get("title")), opensOn: today, closesOn: String(f.get("closes")), status: "open", classIds: picked, shared: false };
    run("create", () => { setRows((r) => [req, ...r]); setOpen(false);
      notify(STUDENTS.filter((s) => s.status === "active" && picked.includes(s.classId)).map((s) => ({ type: "feedback" as const, studentId: s.id, params: {} }))); logAudit({ category: "academic", action: "feedback.requested", summary: `Opened teacher feedback "${req.title}" for ${picked.length} classes`, entity: req.title, href: "/feedback" }); toast.success("Feedback request is open", { description: `Parents of ${picked.length} classes can rate ${targetsFor(req).length} teacher assignments.` }); });
  }

  return (
    <>
      <PageHeader eyebrow="Academic" title="Teacher feedback." dim="Ask parents. Keep it simple." actions={<Button variant="brand" onClick={() => setOpen(true)}><Plus /> New request</Button>} />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => {
          const s = requestSummary(r);
          return (
            <Card key={r.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div><Link href={`/feedback/${r.id}`} className="text-[17px] font-bold hover:text-brand">{r.title}</Link>
                  <p className="text-[13px] text-muted-foreground">{r.status === "open" ? `Closes ${formatDateOn(r.closesOn)}` : `Closed ${formatDateOn(r.closesOn)}`} · {r.classIds.length} classes</p></div>
                <Badge tone={r.status === "open" ? "success" : "neutral"} className="capitalize">{r.status}</Badge>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div><p className="text-xs uppercase tracking-[0.06em] text-text-tertiary">Replied</p><p className="text-2xl font-bold tabular-nums">{s.rate}%</p></div>
                <div><p className="text-xs uppercase tracking-[0.06em] text-text-tertiary">Average</p><p className="flex items-center gap-2 text-2xl font-bold tabular-nums">{s.avg}<Stars value={s.avg} size={14} /></p></div>
              </div>
              <Button asChild variant="secondary" size="sm" className="w-fit"><Link href={`/feedback/${r.id}`}>See results</Link></Button>
            </Card>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ask for feedback</DialogTitle><DialogDescription>Parents rate each teacher of their child from 1 to 5 stars and can add a comment. Answers are anonymous.</DialogDescription></DialogHeader>
          <form onSubmit={create} className="flex flex-col gap-4">
            <Field label="Title" htmlFor="title"><Input id="title" name="title" defaultValue="Teacher feedback" required /></Field>
            <Field label="Closes on" htmlFor="closes"><Input id="closes" name="closes" type="date" min={today} required /></Field>
            <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-medium">Classes</legend>
              <div className="grid grid-cols-3 gap-2">
                {CLASSES.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm">
                    <Checkbox checked={picked.includes(c.id)} onCheckedChange={(on) => setPicked((p) => on ? [...p, c.id] : p.filter((x) => x !== c.id))} />{className(c.id)}
                  </label>
                ))}
              </div>
            </fieldset>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="brand" loading={is("create")}>Open request</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
