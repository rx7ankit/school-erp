"use client";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { useCan } from "@/components/app/can";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currentYear, useAcademic } from "@/lib/academic-setup";
import { useQueryFlag, useSavedDraft, yearEndIsNear } from "@/lib/rollover";
import { formatDateOn } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

/**
 * "Session 2026-27 ends on 31 Mar. Start year-end." For the academic team, from 45 days before the year end.
 * Also shown when a draft exists, or when the address has ?rollover (so the demo can show it any time).
 */
export function YearEndBanner() {
  const can = useCan();
  useAcademic();
  const saved = useSavedDraft();
  const flag = useQueryFlag("rollover");
  const today = useTodayIST();
  if (!can("academic.manage") || !today) return null;
  if (!(yearEndIsNear(today) || flag || saved)) return null;
  const year = currentYear();
  return (
    <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-accent-subtle p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-brand"><GraduationCap className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">Session {year.label} ends on {formatDateOn(year.toOn, "short")}.</p>
        <p className="text-sm text-muted-foreground">{saved ? "Your year-end draft is waiting for you." : "Move everyone up in a few calm steps."}</p>
      </div>
      <Button asChild variant="brand"><Link href="/promotion">{saved ? "Continue year-end" : "Start year-end"}</Link></Button>
    </Card>
  );
}
