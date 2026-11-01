"use client";
import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StarInput } from "@/components/app/charts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useChild } from "@/components/parent-child";
import { STAFF } from "@/lib/mock";
import { FEEDBACK_REQUESTS, targetsFor } from "@/lib/feedback-mock";
import { formatDateOn } from "@/lib/time";
import { usePending } from "@/lib/use-pending";

type Draft = Record<string, { rating: number; comment: string }>;

export default function ParentFeedback() {
  const sel = useChild();
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [done, setDone] = React.useState<Record<string, boolean>>({});
  const { run, pending } = usePending(800);
  if (!sel) return null;
  const { child } = sel;
  const open = child.status === "active" ? FEEDBACK_REQUESTS.filter((r) => r.status === "open" && r.classIds.includes(child.classId)) : [];

  return (
    <>
      <PageHeader eyebrow={child.name} title="Feedback." dim="Tell the school how it is going." />
      {open.length === 0 && <Card className="text-sm text-muted-foreground">Nothing to answer right now.</Card>}
      {open.map((req) => {
        const key = `${req.id}-${child.id}`;
        const answered = done[key];
        const draft = drafts[key] ?? {};
        const set = (tid: string, p: Partial<{ rating: number; comment: string }>) => setDrafts((d) => ({ ...d, [key]: { ...d[key], [tid]: { ...(d[key]?.[tid] ?? { rating: 0, comment: "" }), ...p } } }));
        const rated = Object.values(draft).filter((x) => x.rating > 0).length;
        return (
          <Card key={req.id} className="flex flex-col gap-5">
            <CardHeader className="mb-0"><div><CardTitle>{req.title}</CardTitle><CardDescription>Closes {formatDateOn(req.closesOn)}. Your answers are anonymous to teachers.</CardDescription></div>
              {answered && <Badge tone="success">Sent</Badge>}</CardHeader>
            {answered ? (
              <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-5 text-success" /> Thank you. Your feedback has been sent.</p>
            ) : (<>
              <ul className="flex flex-col gap-5">
                {targetsFor(req, child.classId).map((t) => {
                  const staff = STAFF.find((s) => s.id === t.staffId)!;
                  const d = draft[t.id] ?? { rating: 0, comment: "" };
                  return (
                    <li key={t.id} className="flex flex-col gap-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
                      <div className="flex items-center gap-3"><Avatar name={staff.name} /><div><p className="font-medium">{staff.name}</p><p className="text-xs text-text-tertiary">{t.subject}{t.isClassTeacher && " · Class teacher"}</p></div></div>
                      <StarInput label={`Rating for ${staff.name}`} value={d.rating} onChange={(v) => set(t.id, { rating: v })} />
                      {d.rating > 0 && (
                        <div className="flex flex-col gap-1">
                          <Textarea aria-label={`Comment about ${staff.name} (optional)`} placeholder="Add a comment (optional)" maxLength={500} value={d.comment} onChange={(e) => set(t.id, { comment: e.target.value })} className="min-h-20" />
                          <span className="self-end text-xs tabular-nums text-text-tertiary">{d.comment.length}/500</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Button variant="brand" size="lg" disabled={rated === 0} loading={pending === key} className="self-end"
                onClick={() => run(key, () => { setDone((x) => ({ ...x, [key]: true })); toast.success("Thank you for your feedback"); })}>Send feedback{rated > 0 && ` (${rated})`}</Button>
            </>)}
          </Card>
        );
      })}
    </>
  );
}
