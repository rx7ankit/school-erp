"use client";
import * as React from "react";
import { NoAccess } from "@/components/app/no-access";
import { useCan } from "@/components/app/can";
import { PageHeader } from "@/components/app/page-header";
import { Landing } from "@/components/app/rollover/landing";
import { SuccessScreen } from "@/components/app/rollover/success";
import { Wizard } from "@/components/app/rollover/wizard";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currentYear, useAcademic } from "@/lib/academic-setup";
import { buildDefaults, useLastResult, useQueryParam, useSavedDraft, type RolloverResult } from "@/lib/rollover";

type Phase = "landing" | "wizard" | "done";

export default function PromotionPage() {
  const can = useCan();
  return can("academic.manage") ? <Content /> : <NoAccess need="the Academic permission" />;
}

function Content() {
  const { user } = useSession();
  useAcademic();
  const by = user?.name ?? "Staff";
  const saved = useSavedDraft();
  const last = useLastResult();
  const focus = useQueryParam("class");
  const [phase, setPhase] = React.useState<Phase>("landing");
  const [result, setResult] = React.useState<RolloverResult | null>(null);
  const shown: Phase = phase === "landing" && focus && !result ? "wizard" : phase;
  const year = currentYear();

  if (shown === "done" && result) return <SuccessScreen result={result} />;
  return (
    <>
      <PageHeader eyebrow={`Year-end · ${year.label}`} title="Promotion." dim="Move the whole school up in a few calm steps."
        actions={shown === "landing" && last ? <Button variant="secondary" onClick={() => { setResult(last); setPhase("done"); }}>Last year-end: what is left</Button> : undefined} />
      {shown === "landing" && <Landing saved={saved} onStart={() => setPhase("wizard")} />}
      {shown === "wizard" && (
        <Wizard initial={saved ?? buildDefaults(by, focus ?? undefined)} by={by} onClose={() => setPhase("landing")} onApplied={(r) => { setResult(r); setPhase("done"); }} />
      )}
      {shown === "landing" && !saved && !last && (
        <Card className="text-sm text-muted-foreground">Nothing is changed until you press Apply on the last step. You can leave at any time and continue later.</Card>
      )}
    </>
  );
}
