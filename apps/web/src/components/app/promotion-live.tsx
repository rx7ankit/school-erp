"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/academic/confirm-dialog";
import { useCan } from "@/components/app/can";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { Stepper, STEPS } from "@/components/app/rollover/stepper";
import { ReadinessLive, SideSummaryLive, StepCheckLive, StepFeesLive, StepReviewLive, StepStudentsLive, StepTeachersLive, StepYearLive } from "@/components/app/promotion-live-steps";
import { StatCard } from "@/components/app/stat-card";
import { Problem } from "@/components/app/school-bits";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { isConnected } from "@/lib/features";
import { errorText } from "@/lib/api/hooks/staff";
import { useApply, useChecklist, useDiscardDraft, useDraft, usePreview, useRolloverStatus, useSaveDraft, type ApplyOut, type RolloverPlan, type RolloverStatus } from "@/lib/api/hooks/rollover";
import { formatDateOn, formatIST, formatINR } from "@/lib/time";

/** What goes to the API: no half-filled optional bits (empty name, invoice without a due date). */
function clean(p: RolloverPlan): RolloverPlan {
  const fi = p.fees?.first_invoice;
  return {
    ...p, new_year_name: p.new_year_name?.trim() || null,
    fees: p.fees ? { ...p.fees, first_invoice: fi && fi.due_on ? fi : undefined, write_off_reason: p.fees.dues === "write_off" ? p.fees.write_off_reason : undefined } : p.fees,
  };
}

function Checklist() {
  const list = useChecklist();
  if (list.isPending) return <LoadingBlock label="Loading" />;
  if (list.isError) return <ErrorBlock error={list.error} onRetry={() => list.refetch()} />;
  const items = list.data;
  return (
    <Card>
      <CardHeader><CardTitle>{items.length ? `${items.length} left` : "All done"}</CardTitle></CardHeader>
      {items.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-5 text-success" /> Nothing left.</p> : (
        <ul className="flex flex-col">
          {items.map((x) => (
            <li key={x.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border py-3.5 first:border-t-0 first:pt-0">
              <Circle className="size-5 shrink-0 text-text-tertiary" aria-label="To do" />
              <p className="min-w-0 flex-1 text-sm font-medium">{x.label}{x.count > 0 && <span className="ml-1.5 tabular-nums text-muted-foreground">({x.count})</span>}</p>
              {isConnected(x.link) && <Button asChild size="sm" variant="secondary"><Link href={x.link}>Open</Link></Button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Done({ r }: { r: ApplyOut }) {
  return (
    <>
      <PageHeader title={r.to_year.replace("-", "\u2060-\u2060")} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Moved up" value={r.promoted} hint={r.staying ? `${r.staying} stayed` : undefined} />
        <StatCard label="Passed out" value={r.passed_out} hint={r.leaving ? `${r.leaving} left` : undefined} />
        <StatCard label="New classes" value={r.classes_created} hint={r.invoices_created ? `${r.invoices_created} invoices` : undefined} />
        <StatCard label="Parents notified" value={r.parents_notified} hint={r.dues_written_off_paise ? `${formatINR(r.dues_written_off_paise)} written off` : r.dues_carried_paise ? `${formatINR(r.dues_carried_paise)} carried` : undefined} />
      </div>
      <Checklist />
      <div className="flex flex-wrap gap-2.5">
        <Button asChild variant="brand"><Link href="/dashboard">Dashboard</Link></Button>
        <Button asChild variant="secondary"><Link href="/classes">Classes</Link></Button>
        <Button asChild variant="ghost"><Link href="/students">Students</Link></Button>
      </div>
    </>
  );
}

function Landing({ s, onStart }: { s: RolloverStatus; onStart: () => void }) {
  const discard = useDiscardDraft();
  const [ask, setAsk] = React.useState(false);
  return (
    <>
      <Card className="flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h2 className="text-[22px] font-bold leading-tight tracking-tight">{s.current_year} ends {s.ends_on ? formatDateOn(s.ends_on) : "—"}</h2>
          {s.days_left != null && <p className="mt-1 text-sm text-muted-foreground">{s.days_left > 0 ? `${s.days_left} days left` : s.days_left === 0 ? "Today" : "Ended"}</p>}
        </div>
        <ReadinessLive compact />
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="brand" size="lg" onClick={onStart}>{s.has_draft ? "Continue" : "Start"}</Button>
          {s.has_draft && <button type="button" className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => setAsk(true)}>Discard</button>}
        </div>
      </Card>
      <ConfirmDialog open={ask} title="Discard draft?" text="Your choices are removed." confirmLabel="Discard" loading={discard.isPending}
        onConfirm={() => discard.mutate(undefined, { onSuccess: () => { setAsk(false); toast.success("Draft discarded"); }, onError: (e) => toast.error(errorText(e)) })} onClose={() => setAsk(false)} />
    </>
  );
}

function Wizard({ s, initial, onClose, onApplied }: { s: RolloverStatus; initial: RolloverPlan; onClose: () => void; onApplied: (r: ApplyOut) => void }) {
  const [plan, setPlan] = React.useState<RolloverPlan>(() => ({
    ...initial,
    new_year_name: initial.new_year_name ?? s.suggested_name, starts_on: initial.starts_on ?? s.suggested_starts_on, ends_on: initial.ends_on ?? s.suggested_ends_on,
  }));
  const [step, setStep] = React.useState(0);
  const [ack, setAck] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const top = React.useRef<HTMLDivElement>(null);
  const first = React.useRef(true);
  const save = useSaveDraft(), preview = usePreview(), apply = useApply();
  const { mutate: savePlan } = save, { mutate: runPreview } = preview;

  // Every change is kept as a shared draft, so closing the tab never loses work.
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => savePlan(clean(plan), { onSuccess: (d) => setSavedAt(d.updated_at ?? new Date().toISOString()) }), 900);
    return () => clearTimeout(t);
  }, [plan, savePlan]);
  // The numbers on the side and on the review step come from the API's own dry run.
  React.useEffect(() => { const t = setTimeout(() => runPreview(clean(plan)), 600); return () => clearTimeout(t); }, [plan, runPreview]);

  const update = React.useCallback((f: (p: RolloverPlan) => RolloverPlan) => { setPlan(f); setAck(false); }, []);
  const go = (n: number) => { setStep(Math.max(0, Math.min(STEPS.length - 1, n))); top.current?.scrollIntoView({ block: "start" }); };
  const props = { plan, update };

  function doApply() {
    setError(null);
    if (!s.current_year_id) return;
    apply.mutate({ from_year_id: s.current_year_id, plan: clean(plan) }, { onSuccess: onApplied, onError: (e) => setError(errorText(e)) });
  }
  function saveAndClose() {
    save.mutate(clean(plan), { onSuccess: () => { toast.success("Draft saved"); onClose(); }, onError: (e) => setError(errorText(e)) });
  }

  return (
    <div ref={top} className="grid scroll-mt-4 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Stepper step={step} onGo={go} />
        {step === 0 && <StepCheckLive onLeave={() => save.mutate(clean(plan))} />}
        {step === 1 && <StepStudentsLive {...props} />}
        {step === 2 && <StepYearLive {...props} />}
        {step === 3 && <StepTeachersLive {...props} />}
        {step === 4 && <StepFeesLive {...props} />}
        {step === 5 && <StepReviewLive preview={preview.data} loading={preview.isPending} error={preview.error} onRetry={() => runPreview(clean(plan))} ack={ack} setAck={setAck} applying={apply.isPending} onApply={doApply} />}
        <Problem text={error} />
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button variant="secondary" disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft /> Back</Button>
          <Button variant="ghost" loading={save.isPending && !savedAt} onClick={saveAndClose}>Save and close</Button>
          {savedAt && <span className="hidden text-xs text-text-tertiary sm:inline">Saved {formatIST(savedAt, "time")}</span>}
          {step < STEPS.length - 1 && <Button variant="brand" className="ml-auto" onClick={() => go(step + 1)}>Next <ArrowRight /></Button>}
        </div>
      </div>
      <aside className="hidden lg:block"><div className="sticky top-6"><SideSummaryLive p={preview.data} fromLabel={s.current_year ?? ""} /></div></aside>
    </div>
  );
}

function Content() {
  const status = useRolloverStatus();
  const [phase, setPhase] = React.useState<"landing" | "wizard" | "done">("landing");
  const [result, setResult] = React.useState<ApplyOut | null>(null);
  const draft = useDraft();
  const [starting, setStarting] = React.useState(false);
  const s = status.data;

  if (phase === "done" && result) return <Done r={result} />;
  if (status.isPending) return <><PageHeader title="Promotion" /><LoadingBlock label="Loading" /></>;
  if (status.isError) return <><PageHeader title="Promotion" /><ErrorBlock error={status.error} onRetry={() => status.refetch()} /></>;
  if (!s) return null;

  if (!s.current_year_id) return <><PageHeader title="Promotion" /><Card className="text-sm text-muted-foreground">No academic year. <Link className="font-medium text-foreground hover:underline" href="/academic">Set up</Link></Card></>;

  return (
    <>
      <PageHeader title="Promotion" />
      {phase === "landing" && s.already_applied && (
        <>
          <Card className="text-sm"><b>{s.current_year} year-end done.</b></Card>
          <Checklist />
        </>
      )}
      {phase === "landing" && !s.already_applied && (
        <>
          <Landing s={s} onStart={() => { setStarting(true); draft.refetch().then((r) => { setStarting(false); if (r.data) setPhase("wizard"); else toast.error(errorText(r.error)); }); }} />
          {starting && <p className="text-sm text-muted-foreground" role="status">Opening…</p>}
        </>
      )}
      {phase === "wizard" && draft.data && (
        <Wizard s={s} initial={draft.data.plan as RolloverPlan} onClose={() => setPhase("landing")} onApplied={(r) => { setResult(r); setPhase("done"); }} />
      )}
    </>
  );
}

export function PromotionLive() {
  const can = useCan();
  return can("academic.manage") ? <Content /> : <NoAccess need="the Academic permission" />;
}
