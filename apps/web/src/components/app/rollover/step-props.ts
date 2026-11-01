import type { RolloverDraft } from "@/lib/rollover";
import type { RolloverPlan } from "@/lib/rollover";

/** What every wizard step receives: the draft, the plan derived from it and a way to change the draft. */
export interface StepProps {
  draft: RolloverDraft;
  plan: RolloverPlan;
  update: (change: (d: RolloverDraft) => RolloverDraft) => void;
}
