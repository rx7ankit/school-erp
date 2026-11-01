"use client";
import * as React from "react";
import { CalendarClock } from "lucide-react";
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
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-fill text-muted-foreground"><CalendarClock className="size-5" /></span>
          <div>
            <h2 className="text-[22px] font-bold leading-tight tracking-tight">Session {year.label} ends on {formatDateOn(year.toOn)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {left === null ? "" : left > 0 ? `${left} days left. ` : left === 0 ? "That is today. " : "The session has ended. "}
              Year-end takes a few calm steps and most of it is already filled in for you.
            </p>
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm font-medium">{issues ? `${issues} ${issues === 1 ? "thing" : "things"} to look at first` : "The school looks ready"}</p>
          <ReadinessList compact />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="brand" size="lg" onClick={onStart}>{saved ? "Continue your draft" : "Start year-end"}</Button>
          {saved && (
            <>
              <p className="text-sm text-muted-foreground">Last saved {formatIST(saved.savedAt)} IST by {saved.savedBy}</p>
              <button type="button" className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => setDiscard(true)}>Discard draft</button>
            </>
          )}
        </div>
      </Card>
      <ConfirmDialog open={discard} title="Discard this draft?" text="All the choices you made so far are removed. Nothing in the school has changed." confirmLabel="Discard draft"
        onConfirm={() => { clearDraft(); setDiscard(false); toast.success("Draft discarded"); }} onClose={() => setDiscard(false)} />
    </>
  );
}
