"use client";
import { Card } from "@/components/ui/card";
import type { RolloverPreview } from "@/lib/rollover";
import { formatINR } from "@/lib/time";

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return <div className="flex items-baseline justify-between gap-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className={`font-bold tabular-nums ${tone ?? ""}`}>{value}</dd></div>;
}

/** Live numbers on the side of the wizard (desktop). Updates with every change. */
export function SideSummary({ p, toLabel, fromLabel }: { p: RolloverPreview; toLabel: string; fromLabel: string }) {
  return (
    <Card className="flex flex-col gap-4 p-5" aria-label="Summary">
      <div><p className="text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Summary</p><p className="mt-1 font-bold">{fromLabel} to {toLabel}</p></div>
      <dl className="flex flex-col gap-2.5">
        <Row label="Moving up" value={p.promoted} tone="text-success" />
        <Row label="Staying" value={p.stayed} tone={p.stayed ? "text-warning" : undefined} />
        <Row label="Passing out" value={p.passedOut} />
        <Row label="Leaving" value={p.leaving} tone={p.leaving ? "text-danger" : undefined} />
      </dl>
      <hr className="border-border" />
      <dl className="flex flex-col gap-2.5">
        <Row label="New classes" value={p.newClasses} />
        <Row label="Teacher slots" value={`${p.slotsFilled} of ${p.slotsTotal}`} />
        <Row label="Dues moving on" value={p.duesMovingPaise ? formatINR(p.duesMovingPaise) : "None"} />
        <Row label="Parents notified" value={p.parentsNotified} />
      </dl>
    </Card>
  );
}
