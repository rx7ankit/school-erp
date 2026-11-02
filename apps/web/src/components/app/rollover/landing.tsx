"use client";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/academic/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currentYear, useAcademic } from "@/lib/academic-setup";
import { checkReadiness, clearDraft, daysBetween, type RolloverDraft } from "@/lib/rollover";
import { formatDateOn, formatIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";
import { ReadinessList } from "./readiness-list";

/** Calm starting point: when the session ends, how ready the school is, one big button. */
export function Landing({ saved, onStart }: { saved: RolloverDraft | null; onStart: () => void }) {
  useAcademic();
  const year = currentYear();
  const today = useTodayIST();
  const left = today ? daysBetween(today, year.toOn) : null;
  const issues = checkReadiness().issues;
  const [discard, setDiscard] = React.useState(false);
  return (
    <>
      <Card className="flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h2 className="text-[22px] font-bold leading-tight tracking-tight">{year.label} ends {formatDateOn(year.toOn)}</h2>
          {left !== null && <p className="mt-1 text-sm text-muted-foreground">{left > 0 ? `${left} days left` : left === 0 ? "Today" : "Ended"}</p>}
        </div>
        <div>
          {issues > 0 && <p className="mb-3 text-sm font-medium">{issues} to check</p>}
          <ReadinessList compact />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="brand" size="lg" onClick={onStart}>{saved ? "Continue" : "Start"}</Button>
          {saved && (
            <>
              <p className="text-sm text-muted-foreground">Saved {formatIST(saved.savedAt)}</p>
              <button type="button" className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => setDiscard(true)}>Discard</button>
            </>
          )}
        </div>
      </Card>
      <ConfirmDialog open={discard} title="Discard draft?" text="Your choices are removed." confirmLabel="Discard"
        onConfirm={() => { clearDraft(); setDiscard(false); toast.success("Draft discarded"); }} onClose={() => setDiscard(false)} />
    </>
  );
}
