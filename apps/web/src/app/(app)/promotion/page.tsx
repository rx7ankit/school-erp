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
import { useAcademic } from "@/lib/academic-setup";
import { isLive } from "@/lib/api/config";
import { PromotionLive } from "@/components/app/promotion-live";
import { buildDefaults, useLastResult, useQueryParam, useSavedDraft, type RolloverResult } from "@/lib/rollover";

type Phase = "landing" | "wizard" | "done";

export default function PromotionPage() {
  const can = useCan();
  if (isLive) return <PromotionLive />;
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

  if (shown === "done" && result) return <SuccessScreen result={result} />;
  return (
    <>
      <PageHeader title="Promotion"
        actions={shown === "landing" && last ? <Button variant="secondary" onClick={() => { setResult(last); setPhase("done"); }}>Last year-end</Button> : undefined} />
      {shown === "landing" && <Landing saved={saved} onStart={() => setPhase("wizard")} />}
      {shown === "wizard" && (
        <Wizard initial={saved ?? buildDefaults(by, focus ?? undefined)} by={by} onClose={() => setPhase("landing")} onApplied={(r) => { setResult(r); setPhase("done"); }} />
      )}
    </>
  );
}
