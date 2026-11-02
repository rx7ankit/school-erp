"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquareText, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { Problem, ExcelButton } from "@/components/app/bits-a3";
import { ErrorBlock, LoadingBlock, classLabel } from "@/components/app/academic-live-ui";
import { Stars } from "@/components/app/charts";
import { useSession } from "@/components/session-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useClasses } from "@/lib/api/hooks/academic";
import { useCloseFeedback, useCreateFeedback, useFeedback, useFeedbackList, useMyFeedback, useOpenFeedback, type FeedbackRow, type TargetSummary } from "@/lib/api/hooks/feedback";
import { hasAccess } from "@/lib/permissions";
import { formatDateOn } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const TONE = { open: "success", draft: "warning", closed: "neutral" } as const;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** One person's ratings across every class and subject they were rated for. */
interface TeacherCard { name: string; places: string[]; count: number; avg: number | null; spread: number[]; comments: string[]; expected: number }
function byTeacher(targets: TargetSummary[]): TeacherCard[] {
  const m = new Map<string, TeacherCard & { sum: number }>();
  for (const t of targets) {
    const c = m.get(t.teacher) ?? { name: t.teacher, places: [], count: 0, avg: null, spread: [0, 0, 0, 0, 0], comments: [], expected: 0, sum: 0 };
    c.places.push(`${t.subject ?? "Class teacher"}, Class ${t.class_name}`);
    c.count += t.responses; c.sum += (t.average ?? 0) * t.responses; c.expected += t.expected;
    for (let i = 1; i <= 5; i++) c.spread[i - 1] += t.spread[String(i)] ?? 0;
    c.comments.push(...t.comments);
    m.set(t.teacher, c);
  }
  return [...m.values()].map((c) => ({ ...c, avg: c.count ? round1(c.sum / c.count) : null })).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
}

function TeacherCards({ cards }: { cards: TeacherCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((r) => (
        <Card key={r.name} className="flex flex-col gap-4">
          <div className="flex items-center gap-3"><Avatar name={r.name} /><div className="min-w-0 flex-1"><p className="font-bold">{r.name}</p><p className="text-xs text-text-tertiary">{r.places.join(" · ")}</p></div>
            <div className="text-right"><p className="text-2xl font-bold tabular-nums">{r.avg ?? "—"}</p>{r.avg !== null && <Stars value={r.avg} size={13} />}</div></div>
          <ul className="flex flex-col gap-1.5" aria-label="Rating spread">
            {[5, 4, 3, 2, 1].map((n) => (
              <li key={n} className="grid grid-cols-[18px_1fr_20px] items-center gap-2 text-xs"><span className="tabular-nums text-muted-foreground">{n}</span>
                <div className="h-2 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full bg-solid" style={{ width: `${r.count ? (r.spread[n - 1] / r.count) * 100 : 0}%` }} /></div><span className="text-right tabular-nums text-text-tertiary">{r.spread[n - 1]}</span></li>
            ))}
          </ul>
          {r.comments.length > 0 && <ul className="flex flex-col gap-2">{r.comments.map((c, i) => <li key={i} className="rounded-xl bg-fill px-3 py-2 text-sm">{c}</li>)}</ul>}
          <div className="flex flex-wrap gap-2"><Badge>{r.count} {r.count === 1 ? "rating" : "ratings"}</Badge>{r.expected > 0 && <Badge>{Math.round((r.count / r.expected) * 100)}% of {r.expected} students</Badge>}</div>
        </Card>
      ))}
    </div>
  );
}

/** What a teacher may see about themselves: only requests shared with teachers and already closed. */
function MyFeedback() {
  const mine = useMyFeedback();
  if (mine.isError) return <ErrorBlock error={mine.error} onRetry={() => mine.refetch()} />;
  if (!mine.data) return <LoadingBlock label="Loading your feedback" />;
  if (!mine.data.length) return <EmptyState icon={MessageSquareText} title="Nothing to show yet" text="Parents' feedback about you appears here once the school closes a request and shares it with teachers. Comments never carry names." />;
  return (
    <div className="flex flex-col gap-6">
      {mine.data.map((r) => (
        <section key={r.request_id} className="flex flex-col gap-3">
          <div><h2 className="text-[17px] font-bold">{r.title}</h2><p className="text-[13px] text-muted-foreground">Closed {formatDateOn(r.closes_on)}</p></div>
          <TeacherCards cards={byTeacher(r.summaries)} />
        </section>
      ))}
    </div>
  );
}

export function FeedbackLive() {
  const { user } = useSession();
  const manager = hasAccess(user, "academic.manage");
  const list = useFeedbackList(manager);
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <PageHeader eyebrow="Academic" title="Teacher feedback." dim="Ask parents. Keep it simple."
        actions={manager && <Button variant="brand" onClick={() => setOpen(true)}><Plus /> New request</Button>} />
      {manager && (list.isError ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : !list.data ? <LoadingBlock label="Loading requests" /> :
        list.data.length === 0 ? <EmptyState icon={MessageSquareText} title="No feedback request yet" text="Ask parents to rate each teacher of their child from 1 to 5 stars. Answers are anonymous." action={<Button variant="brand" onClick={() => setOpen(true)}><Plus /> New request</Button>} /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.data.map((r) => <RequestCard key={r.id} r={r} />)}
          </div>
        ))}
      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold">{manager ? "About me" : "Feedback about me"}</h2>
        <MyFeedback />
      </section>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>{open && <NewRequest onClose={() => setOpen(false)} />}</DialogContent></Dialog>
    </>
  );
}

function RequestCard({ r }: { r: FeedbackRow }) {
  const open = useOpenFeedback();
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div><Link href={`/feedback/${r.id}`} className="text-[17px] font-bold hover:text-brand">{r.title}</Link>
          <p className="text-[13px] text-muted-foreground">{r.status === "draft" ? `Draft · closes ${formatDateOn(r.closes_on)}` : r.status === "open" ? `Closes ${formatDateOn(r.closes_on)}` : `Closed ${formatDateOn(r.closes_on)}`} · {r.targets} {r.targets === 1 ? "teacher" : "teachers"} to rate</p></div>
        <Badge tone={TONE[r.status as keyof typeof TONE] ?? "neutral"} className="capitalize">{r.status}</Badge>
      </div>
      <div className="flex items-center gap-6 text-sm"><div><p className="text-xs uppercase tracking-[0.06em] text-text-tertiary">Ratings</p><p className="text-2xl font-bold tabular-nums">{r.responses}</p></div>
        <div><p className="text-xs uppercase tracking-[0.06em] text-text-tertiary">Shared with teachers</p><p className="text-2xl font-bold">{r.share_with_teachers ? "Yes" : "No"}</p></div></div>
      <div className="flex gap-2"><Button asChild variant="secondary" size="sm"><Link href={`/feedback/${r.id}`}>See results</Link></Button>
        {r.status === "draft" && <Button size="sm" variant="brand" loading={open.isPending} onClick={() => open.mutate(r.id, { onSuccess: () => toast.success("Feedback request is open"), onError: (e) => toast.error(e.message) })}>Open now</Button>}</div>
    </Card>
  );
}

function NewRequest({ onClose }: { onClose: () => void }) {
  const today = useTodayIST();
  const classes = useClasses(), create = useCreateFeedback();
  const [title, setTitle] = React.useState("Teacher feedback");
  const [closes, setClosesOn] = React.useState("");
  const [picked, setPicked] = React.useState<string[] | null>(null);
  const [share, setShare] = React.useState(false);
  const [openNow, setOpenNow] = React.useState(true);
  const [err, setErr] = React.useState<unknown>(null);
  const all = classes.data?.items ?? [];
  const ids = picked ?? all.map((c) => c.id);
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault(); setErr(null);
      create.mutate({ title: title.trim(), class_ids: ids, closes_on: closes, share_with_teachers: share, open_now: openNow }, {
        onSuccess: (r) => { toast.success(openNow ? "Feedback request is open" : "Saved as a draft", { description: `${r.targets} ${r.targets === 1 ? "teacher" : "teachers"} to be rated.` }); onClose(); },
        onError: setErr,
      });
    }}>
      <DialogHeader><DialogTitle>Ask for feedback</DialogTitle><DialogDescription>Parents rate each teacher of their child from 1 to 5 stars and can add a comment. Answers are anonymous.</DialogDescription></DialogHeader>
      <Field label="Title" htmlFor="ft"><Input id="ft" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></Field>
      <Field label="Closes on" htmlFor="fc"><Input id="fc" type="date" min={today || undefined} value={closes} onChange={(e) => setClosesOn(e.target.value)} required /></Field>
      <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-medium">Classes</legend>
        {classes.isError ? <Problem error={classes.error} /> : (
          <div className="grid grid-cols-3 gap-2">
            {all.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm"><Checkbox checked={ids.includes(c.id)} onCheckedChange={(on) => setPicked(on ? [...ids, c.id] : ids.filter((x) => x !== c.id))} />{classLabel(c)}</label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-fill px-4 py-3"><div><Label htmlFor="fs">Share results with teachers</Label><p className="text-xs text-text-tertiary">Each teacher sees only their own rating and comments, after the request closes.</p></div><Switch id="fs" checked={share} onCheckedChange={setShare} /></div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-fill px-4 py-3"><div><Label htmlFor="fo">Open to parents now</Label><p className="text-xs text-text-tertiary">Turn off to keep it as a draft and open it later.</p></div><Switch id="fo" checked={openNow} onCheckedChange={setOpenNow} /></div>
      <Problem error={err} />
      <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={create.isPending} disabled={!title.trim() || !closes || !ids.length}>{openNow ? "Open request" : "Save draft"}</Button></DialogFooter>
    </form>
  );
}

export function FeedbackDetailLive({ id }: { id: string }) {
  const q = useFeedback(id), open = useOpenFeedback(), close = useCloseFeedback();
  const [err, setErr] = React.useState<unknown>(null);
  const d = q.data;
  const cards = React.useMemo(() => (d ? byTeacher(d.teachers) : []), [d]);
  const given = d?.teachers.reduce((s, t) => s + t.responses, 0) ?? 0;
  const avg = given ? round1(d!.teachers.reduce((s, t) => s + (t.average ?? 0) * t.responses, 0) / given) : null;
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link href="/feedback"><ArrowLeft /> Feedback</Link></Button>
      {q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : !d ? <LoadingBlock label="Loading results" /> : (
        <>
          <PageHeader eyebrow={`${d.status === "closed" ? "Closed" : d.status === "draft" ? "Draft, closes" : "Closes"} ${formatDateOn(d.closes_on)}`} title={`${d.title}.`} dim="Anonymous results."
            actions={<>
              <ExcelButton path={`/feedback/${id}/export`} fallbackName="teacher-feedback.xlsx" />
              {d.status === "draft" && <Button variant="brand" loading={open.isPending} onClick={() => { setErr(null); open.mutate(id, { onSuccess: () => toast.success("Feedback request is open"), onError: setErr }); }}>Open now</Button>}
              {d.status === "open" && <Button variant="secondary" loading={close.isPending} onClick={() => { setErr(null); close.mutate(id, { onSuccess: () => toast.success("Request closed"), onError: setErr }); }}>Close now</Button>}
            </>} />
          <Problem error={err} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Parents replied" value={`${Math.round(d.response_rate * 100)}%`} hint={`${d.responses} ${d.responses === 1 ? "rating" : "ratings"} in all`} />
            <StatCard label="Average rating" value={avg ?? "—"} hint="Out of 5" />
            <StatCard label="Ratings given" value={given} />
            <StatCard label="Teachers rated" value={cards.length} />
          </div>
          <Card className="py-4"><p className="font-medium">{d.share_with_teachers ? "Shared with teachers" : "Only managers can see these results"}</p>
            <p className="text-[13px] text-muted-foreground">{d.share_with_teachers ? "Each teacher sees their own rating and comments once the request is closed. Never names." : "This request was created without sharing results with teachers."}</p></Card>
          {cards.length === 0 ? <EmptyState icon={MessageSquareText} title="No teachers to rate" text="Teachers appear here once classes have teachers assigned in Academic." /> : <TeacherCards cards={cards} />}
        </>
      )}
    </>
  );
}
