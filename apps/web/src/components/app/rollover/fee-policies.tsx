"use client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CardHeader><div><CardTitle>Concessions</CardTitle><CardDescription>Choose which ones continue next year. The rest end for everyone who has them.</CardDescription></div></CardHeader>
      <ul className="flex flex-col gap-2">
        {CONCESSIONS.map((c) => {
          const n = ASSIGNMENTS.filter((a) => a.concessionId === c.id).length;
          return (
            <li key={c.id} className="flex items-center gap-4 rounded-xl bg-fill px-4 py-3">
              <label htmlFor={`carry-${c.id}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-medium">{c.name}</span>
                <span className="block text-xs text-muted-foreground">{concessionLabel(c)} · {n} {n === 1 ? "student" : "students"}</span>
              </label>
              <span className="text-xs text-muted-foreground">{carryOn(draft, c.id) ? "Carry over" : "Ends"}</span>
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
      <CardHeader><div><CardTitle>Previous dues</CardTitle><CardDescription>{dues.students.length ? `${formatINR(dues.paise)} is unpaid by ${dues.students.length} students.` : "Nothing is unpaid."} Last year&apos;s invoices are kept either way.</CardDescription></div></CardHeader>
      <ChoiceGroup label="Previous dues" value={draft.fees.dues} onChange={(v) => update((d) => ({ ...d, fees: { ...d.fees, dues: v } }))} options={[
        { value: "carry", title: "Carry forward to the new invoice", text: "The first invoice of the new year shows a Previous dues line." },
        { value: "writeoff", title: "Write off", text: "The balance is cleared. A reason is required and it is flagged in the audit log." },
      ]} />
      {draft.fees.dues === "writeoff" && (
        <div className="mt-4"><Field label="Reason for writing off" htmlFor="ro-writeoff" hint="Visible to the principal in the audit log.">
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
      <CardHeader><div><CardTitle>First invoices</CardTitle><CardDescription>Every student starts the year with empty payments. You can also generate invoices later from Fees.</CardDescription></div></CardHeader>
      <ChoiceGroup label="First invoices" value={draft.fees.invoices} onChange={(v) => set({ invoices: v })} options={[
        { value: "later", title: "Later", text: "It stays on your checklist." },
        { value: "now", title: "Create them now", text: "One invoice per student for the period below, right after the rollover." },
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
