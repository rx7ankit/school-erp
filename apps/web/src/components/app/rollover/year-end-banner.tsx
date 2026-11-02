"use client";
import Link from "next/link";
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
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
      <p className="font-bold">{year.label} ends {formatDateOn(year.toOn, "short")}</p>
      <Button asChild variant="brand"><Link href="/promotion">{saved ? "Continue" : "Year-end"}</Link></Button>
    </Card>
  );
}
