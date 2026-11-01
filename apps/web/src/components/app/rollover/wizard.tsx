"use client";
import * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyRollover, buildPlan, previewRollover, saveDraft, type RolloverDraft, type RolloverResult } from "@/lib/rollover";
import { formatIST } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { SideSummary } from "./side-summary";
import { StepCheck } from "./step-check";
import { StepFees } from "./step-fees";
import { StepReview } from "./step-review";
import { StepStudents } from "./step-students";
import { StepSubjects } from "./step-subjects";
import { StepYear } from "./step-year";
import { Stepper, STEPS } from "./stepper";

/** The six steps with Back, Next, a live side summary and an always-available "Save draft and close". */
export function Wizard({ initial, by, onApplied, onClose }: { initial: RolloverDraft; by: string; onApplied: (r: RolloverResult) => void; onClose: () => void }) {
  const [draft, setDraft] = React.useState(initial);
  const [error, setError] = React.useState("");
  const [savedAt, setSavedAt] = React.useState(initial.savedAt);
  const { run, is } = usePending(1000);
  const finished = React.useRef(false);
  const top = React.useRef<HTMLDivElement>(null);
  const plan = React.useMemo(() => buildPlan(draft), [draft]);
  const preview = React.useMemo(() => previewRollover(draft), [draft]);

  // Every change is kept as a draft, so closing the tab never loses work.
  React.useEffect(() => {
    if (finished.current) return;
    setSavedAt(saveDraft(draft, by).savedAt);
  }, [draft, by]);

  const update = React.useCallback((change: (d: RolloverDraft) => RolloverDraft) => setDraft(change), []);
  const go = (n: number) => { setDraft((d) => ({ ...d, step: Math.max(0, Math.min(STEPS.length - 1, n)) })); top.current?.scrollIntoView({ block: "start" }); };
  const props = { draft, plan, update };

  function apply() {
    setError("");
    void run("apply", () => {
      try { const r = applyRollover(draft, by); finished.current = true; onApplied(r); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Nothing was changed."); }
    });
  }

  return (
    <div ref={top} className="grid scroll-mt-4 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Stepper step={draft.step} onGo={go} />
        {draft.step === 0 && <StepCheck onLeave={() => saveDraft(draft, by)} />}
        {draft.step === 1 && <StepStudents {...props} />}
        {draft.step === 2 && <StepYear {...props} />}
        {draft.step === 3 && <StepSubjects {...props} />}
        {draft.step === 4 && <StepFees {...props} />}
        {draft.step === 5 && <StepReview {...props} preview={preview} applying={is("apply")} onApply={apply} />}
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button variant="secondary" disabled={draft.step === 0} onClick={() => go(draft.step - 1)}><ArrowLeft /> Back</Button>
          <Button variant="ghost" onClick={() => { saveDraft(draft, by); toast.success("Draft saved", { description: "Anyone with Academic access can continue it." }); onClose(); }}>Save draft and close</Button>
          <span className="hidden text-xs text-text-tertiary sm:inline">Draft saved {formatIST(savedAt, "time")} IST</span>
          {draft.step < STEPS.length - 1 && <Button variant="brand" className="ml-auto" onClick={() => go(draft.step + 1)}>Next: {STEPS[draft.step + 1]} <ArrowRight /></Button>}
        </div>
      </div>
      <aside className="hidden lg:block"><div className="sticky top-6"><SideSummary p={preview} fromLabel={draft.fromLabel} toLabel={draft.year.label} /></div></aside>
    </div>
  );
}
