"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";
import { HEADS, STRUCTURE, saveStructure, useFeesStore } from "@/lib/fees-setup";
import { CLASSES, className } from "@/lib/mock";
import { formatINR } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { Grid3x3 } from "lucide-react";

type Draft = Record<string, Record<string, string>>; // classId -> headId -> rupees as typed
const toDraft = (): Draft => Object.fromEntries(CLASSES.map((c) => [c.id, Object.fromEntries(HEADS.map((h) => [h.id, String((STRUCTURE[c.id]?.[h.id] ?? 0) / 100)]))]));

export function ClassFeesTab() {
  useFeesStore();
  const [draft, setDraft] = React.useState<Draft>(toDraft);
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});
  const { run, is } = usePending();
  if (!HEADS.length) return <EmptyState icon={Grid3x3} title="Add a fee head first" text="Class fees are set per head. Add heads in the Fee heads tab." />;

  const amount = (c: string, h: string) => draft[c]?.[h] ?? "";
  const paise = (v: string) => Math.round(Number(v || 0) * 100);
  const total = (c: string) => HEADS.reduce((a, h) => a + (Number.isFinite(paise(amount(c, h.id))) ? paise(amount(c, h.id)) : 0), 0);
  const dirty = CLASSES.some((c) => HEADS.some((h) => paise(amount(c.id, h.id)) !== (STRUCTURE[c.id]?.[h.id] ?? 0)));

  function save() {
    const bad: Record<string, boolean> = {};
    CLASSES.forEach((c) => HEADS.forEach((h) => { const n = Number(amount(c.id, h.id) || 0); if (!Number.isFinite(n) || n < 0) bad[`${c.id}.${h.id}`] = true; }));
    setErrors(bad);
    if (Object.keys(bad).length) { toast.error("Amounts must be zero or more"); return; }
    run("save", () => {
      saveStructure(Object.fromEntries(CLASSES.map((c) => [c.id, Object.fromEntries(HEADS.map((h) => [h.id, paise(amount(c.id, h.id))]))])));
      toast.success("Class fees saved", { description: "New amounts apply to invoices generated from now on." });
    });
  }
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>Class fees</CardTitle></div>
        <Button variant="brand" loading={is("save")} disabled={!dirty} onClick={save}>Save class fees</Button>
      </CardHeader>
      <Table className="min-w-[720px]">
        <TableHeader><TableRow><TableHead>Class</TableHead>{HEADS.map((h) => <TableHead key={h.id} className="text-right">{h.name}</TableHead>)}<TableHead className="text-right">All heads</TableHead></TableRow></TableHeader>
        <TableBody>
          {CLASSES.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">Class {className(c.id)}</TableCell>
              {HEADS.map((h) => (
                <TableCell key={h.id} className="text-right">
                  <Input aria-label={`${h.name} for class ${className(c.id)} in rupees`} aria-invalid={errors[`${c.id}.${h.id}`] || undefined} inputMode="decimal"
                    className="ml-auto h-9 w-28 text-right tabular-nums" value={amount(c.id, h.id)}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.id]: { ...d[c.id], [h.id]: e.target.value } }))} />
                </TableCell>
              ))}
              <TableCell className="text-right font-bold tabular-nums">{formatINR(total(c.id))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
