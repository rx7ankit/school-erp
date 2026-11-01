"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { activeHeads, feeAmount } from "@/lib/rollover";
import type { RolloverDraft } from "@/lib/rollover";
import type { RolloverPlan } from "@/lib/rollover";

/** Rewrite every cell of the grid with `fn(current paise)`. */
export function mapGrid(d: RolloverDraft, plan: RolloverPlan, fn: (paise: number) => number): RolloverDraft {
  const grid: RolloverDraft["fees"]["grid"] = {};
  for (const c of plan.classes) grid[c.key] = Object.fromEntries(activeHeads(d).map((h) => [h.id, Math.max(0, fn(feeAmount(d, c.key, h.id)))]));
  return { ...d, fees: { ...d.fees, grid } };
}

/** "Increase all by %" and "Round to nearest" over the whole grid. */
export function FeeTools({ plan, update }: { plan: RolloverPlan; update: (f: (d: RolloverDraft) => RolloverDraft) => void }) {
  const [pct, setPct] = React.useState("5");
  const [nearest, setNearest] = React.useState("100");
  const p = Number(pct);
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl bg-fill px-4 py-3">
      <div className="flex items-center gap-2">
        <label htmlFor="ro-pct" className="text-sm font-medium">Increase all by</label>
        <Input id="ro-pct" inputMode="decimal" className="h-9 w-16 bg-card text-right tabular-nums" value={pct} onChange={(e) => setPct(e.target.value)} />
        <span className="text-sm">%</span>
        <Button size="sm" variant="secondary" disabled={!Number.isFinite(p) || p === 0} onClick={() => update((d) => mapGrid(d, plan, (v) => Math.round(v * (1 + p / 100))))}>Apply</Button>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="ro-round" className="text-sm font-medium">Round to nearest</label>
        <NativeSelect id="ro-round" className="w-28" value={nearest} onChange={(e) => setNearest(e.target.value)}>
          {[10, 50, 100, 500, 1000].map((n) => <option key={n} value={n}>₹{n}</option>)}
        </NativeSelect>
        <Button size="sm" variant="secondary" onClick={() => { const step = Number(nearest) * 100; update((d) => mapGrid(d, plan, (v) => Math.round(v / step) * step)); }}>Apply</Button>
      </div>
    </div>
  );
}
