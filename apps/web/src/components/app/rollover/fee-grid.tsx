"use client";
import * as React from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FREQUENCY_LABEL, type Frequency } from "@/lib/fees-setup";
import { activeHeads, classFeeTotal, feeAmount, keyLabel } from "@/lib/rollover";
import { formatINR } from "@/lib/time";
import { AmountCell } from "./amount-cell";
import { FeeTools } from "./fee-tools";
import type { StepProps } from "./step-props";

/** New class by fee head. Prefilled from this year's amounts for the new grade; every cell can be edited. */
export function FeeGrid({ draft, plan, update }: StepProps) {
  const heads = activeHeads(draft);
  const [name, setName] = React.useState("");
  const [freq, setFreq] = React.useState<Frequency>("term");
  const [error, setError] = React.useState("");
  const setCell = (key: string, headId: string, paise: number) => update((d) => ({ ...d, fees: { ...d.fees, grid: { ...d.fees.grid, [key]: { ...d.fees.grid[key], [headId]: paise } } } }));
  function addHead() {
    const n = name.trim();
    if (n.length < 2) return setError("Name too short.");
    if (heads.some((h) => h.name.toLowerCase() === n.toLowerCase())) return setError("Already exists.");
    setError(""); setName("");
    update((d) => ({ ...d, fees: { ...d.fees, newHeads: [...d.fees.newHeads, { id: `new-${Date.now().toString(36)}`, name: n, frequency: freq }] } }));
  }
  const removeHead = (id: string, isNew: boolean) => update((d) => ({ ...d, fees: isNew ? { ...d.fees, newHeads: d.fees.newHeads.filter((h) => h.id !== id) } : { ...d.fees, removedHeads: [...d.fees.removedHeads, id] } }));
  return (
    <Card>
      <CardHeader><CardTitle>Class fees</CardTitle></CardHeader>
      <FeeTools plan={plan} update={update} />
      <div className="mt-4 overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              {heads.map((h) => (
                <TableHead key={h.id} className="text-right">
                  <span className="inline-flex items-center gap-1">
                    {h.name}
                    <button type="button" aria-label={`Remove ${h.name} fee head`} className="grid size-5 cursor-pointer place-items-center rounded-full text-text-tertiary hover:bg-separator hover:text-foreground" onClick={() => removeHead(h.id, h.id.startsWith("new-"))}><X className="size-3" /></button>
                  </span>
                  <span className="block text-[11px] font-normal text-text-tertiary">{FREQUENCY_LABEL[h.frequency]}</span>
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.classes.map((c) => (
              <TableRow key={c.key}>
                <TableCell className="font-medium">Class {keyLabel(c.key)}{c.total === 0 && <Badge className="ml-2">Empty</Badge>}</TableCell>
                {heads.map((h) => (
                  <TableCell key={h.id} className="text-right"><AmountCell label={`${h.name} for class ${keyLabel(c.key)} in rupees`} paise={feeAmount(draft, c.key, h.id)} onValue={(v) => setCell(c.key, h.id, v)} /></TableCell>
                ))}
                <TableCell className="text-right font-bold tabular-nums">{formatINR(classFeeTotal(draft, c.key))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <form className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5" onSubmit={(e) => { e.preventDefault(); addHead(); }}>
        <div className="flex flex-col gap-2"><label htmlFor="ro-head" className="text-sm font-medium">Fee head</label><Input id="ro-head" className="w-48" placeholder="Smart class" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <NativeSelect aria-label="How often" className="w-36" value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>
          {Object.entries(FREQUENCY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </NativeSelect>
        <Button type="submit" variant="secondary"><Plus /> Add</Button>
        {error && <p role="alert" className="pb-2.5 text-xs text-danger">{error}</p>}
      </form>
    </Card>
  );
}
