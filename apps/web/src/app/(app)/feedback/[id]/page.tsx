"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { StatCard } from "@/components/app/stat-card";
import { Stars } from "@/components/app/charts";
import { useCan } from "@/components/app/can";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { STAFF, className } from "@/lib/mock";
import { FEEDBACK_REQUESTS, requestSummary, summaryFor, targetsFor } from "@/lib/feedback-mock";
import { usePending } from "@/lib/use-pending";
import { isLive } from "@/lib/api/config";
import { FeedbackDetailLive } from "@/components/app/feedback-live";

export default function FeedbackResults({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return isLive ? <FeedbackDetailLive id={id} /> : <FeedbackDemoDetail id={id} />;
}

function FeedbackDemoDetail({ id }: { id: string }) {
  const can = useCan();
  const base = FEEDBACK_REQUESTS.find((r) => r.id === id);
  const [shared, setShared] = React.useState<boolean | null>(null);
  const [closed, setClosed] = React.useState(false);
  const { run, is } = usePending();
  if (!can("academic.manage")) return <NoAccess need="the Academic permission" />;
  if (!base) return <p className="text-muted-foreground">Not found.</p>;
  const req = { ...base, shared: shared ?? base.shared, status: closed ? ("closed" as const) : base.status };
  const sum = requestSummary(req);
  // One card per teacher: combine their ratings across every class they teach.
  const byTeacher = new Map<string, { staff: (typeof STAFF)[number]; classes: string[]; subjects: Set<string>; classTeacher: boolean; count: number; sum: number; spread: number[]; comments: string[] }>();
  for (const t of targetsFor(req)) {
    const s = summaryFor(t, req.status === "closed");
    const cur = byTeacher.get(t.staffId) ?? { staff: STAFF.find((x) => x.id === t.staffId)!, classes: [], subjects: new Set<string>(), classTeacher: false, count: 0, sum: 0, spread: [0, 0, 0, 0, 0], comments: [] };
    cur.classes.push(className(t.classId)); cur.subjects.add(t.subject); cur.classTeacher ||= t.isClassTeacher;
    cur.count += s.count; cur.sum += s.avg * s.count; s.spread.forEach((n, i) => (cur.spread[i] += n)); cur.comments.push(...s.comments);
    byTeacher.set(t.staffId, cur);
  }
  const rows = [...byTeacher.values()].map((r) => ({ ...r, avg: Math.round((r.sum / r.count) * 10) / 10 })).sort((a, b) => b.avg - a.avg);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link href="/feedback"><ArrowLeft /> Feedback</Link></Button>
      <PageHeader title={`${req.title}.`}
        actions={req.status === "open" && <Button variant="secondary" loading={is("close")} onClick={() => run("close", () => { setClosed(true); toast.success("Request closed"); })}>Close</Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Replied" value={`${sum.rate}%`} />
        <StatCard label="Average" value={sum.avg} />
        <StatCard label="Ratings" value={sum.answers} />
        <StatCard label="Teachers" value={rows.length} />
      </div>
      <Card className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="font-medium">Share with teachers</p>
        <div className="flex items-center gap-3"><Label htmlFor="share">Share</Label><Switch id="share" checked={req.shared} onCheckedChange={(on) => { setShared(on); toast.success(on ? "Shared" : "Private"); }} /></div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.staff.id} className="flex flex-col gap-4">
            <div className="flex items-center gap-3"><Avatar name={r.staff.name} /><div className="min-w-0 flex-1"><p className="font-bold">{r.staff.name}</p><p className="text-xs text-text-tertiary">{[...r.subjects].join(", ")} · Class {r.classes.join(", ")}{r.classTeacher && " · Class teacher"}</p></div>
              <div className="text-right"><p className="text-2xl font-bold tabular-nums">{r.avg}</p><Stars value={r.avg} size={13} /></div></div>
            <ul className="flex flex-col gap-1.5" aria-label="Rating spread">
              {[5, 4, 3, 2, 1].map((n) => (
                <li key={n} className="grid grid-cols-[18px_1fr_20px] items-center gap-2 text-xs"><span className="tabular-nums text-muted-foreground">{n}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full bg-solid" style={{ width: `${(r.spread[n - 1] / r.count) * 100}%` }} /></div><span className="text-right tabular-nums text-text-tertiary">{r.spread[n - 1]}</span></li>
              ))}
            </ul>
            <ul className="flex flex-col gap-2">{[...new Set(r.comments)].slice(0, 3).map((c) => <li key={c} className="rounded-xl bg-fill px-3 py-2 text-sm">{c}</li>)}</ul>
            <Badge className="w-fit">{r.count}</Badge>
          </Card>
        ))}
      </div>
    </>
  );
}
