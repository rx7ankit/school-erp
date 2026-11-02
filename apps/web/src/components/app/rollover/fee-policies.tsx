"use client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/app/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ASSIGNMENTS, CONCESSIONS, concessionLabel } from "@/lib/fees-setup";
import { carryOn, openDues } from "@/lib/rollover";
import { formatDateOn, formatINR } from "@/lib/time";
import { ChoiceGroup } from "./choice-card";
import type { StepProps } from "./step-props";

export function ConcessionCarry({ draft, update }: StepProps) {
  return (
    <Card>
      <CardHeader><CardTitle>Concessions</CardTitle></CardHeader>
      <ul className="flex flex-col gap-2">
        {CONCESSIONS.map((c) => {
          const n = ASSIGNMENTS.filter((a) => a.concessionId === c.id).length;
          return (
            <li key={c.id} className="flex items-center gap-4 rounded-xl bg-fill px-4 py-3">
              <label htmlFor={`carry-${c.id}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-medium">{c.name}</span>
                <span className="block text-xs text-muted-foreground">{concessionLabel(c)} · {n} {n === 1 ? "student" : "students"}</span>
              </label>
              <span className="text-xs text-muted-foreground">{carryOn(draft, c.id) ? "Carry" : "Ends"}</span>
              <Switch id={`carry-${c.id}`} aria-label={`Carry over ${c.name}`} checked={carryOn(draft, c.id)} onCheckedChange={(v) => update((d) => ({ ...d, fees: { ...d.fees, carry: { ...d.fees.carry, [c.id]: v } } }))} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function DuesChoice({ draft, update }: StepProps) {
  const dues = openDues();
  return (
    <Card>
      <CardHeader><CardTitle>Dues</CardTitle><span className="text-sm text-muted-foreground">{dues.students.length ? `${formatINR(dues.paise)} · ${dues.students.length} students` : "None"}</span></CardHeader>
      <ChoiceGroup label="Previous dues" value={draft.fees.dues} onChange={(v) => update((d) => ({ ...d, fees: { ...d.fees, dues: v } }))} options={[
        { value: "carry", title: "Carry forward" },
        { value: "writeoff", title: "Write off" },
      ]} />
      {draft.fees.dues === "writeoff" && (
        <div className="mt-4"><Field label="Reason" htmlFor="ro-writeoff">
          <Textarea id="ro-writeoff" rows={2} aria-invalid={draft.fees.writeoffReason.trim().length < 5 || undefined} value={draft.fees.writeoffReason} onChange={(e) => update((d) => ({ ...d, fees: { ...d.fees, writeoffReason: e.target.value } }))} />
        </Field></div>
      )}
    </Card>
  );
}

export function FirstInvoices({ draft, update }: StepProps) {
  const set = (p: Partial<typeof draft.fees>) => update((d) => ({ ...d, fees: { ...d.fees, ...p } }));
  return (
    <Card>
      <CardHeader><CardTitle>First invoices</CardTitle></CardHeader>
      <ChoiceGroup label="First invoices" value={draft.fees.invoices} onChange={(v) => set({ invoices: v })} options={[
        { value: "later", title: "Later" },
        { value: "now", title: "Create now" },
      ]} />
      {draft.fees.invoices === "now" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Period" htmlFor="ro-period"><Input id="ro-period" value={draft.fees.period} onChange={(e) => set({ period: e.target.value })} /></Field>
          <Field label="Due date" htmlFor="ro-due" hint={draft.fees.dueOn ? formatDateOn(draft.fees.dueOn) : undefined}><Input id="ro-due" type="date" value={draft.fees.dueOn} onChange={(e) => set({ dueOn: e.target.value })} /></Field>
        </div>
      )}
    </Card>
  );
}
