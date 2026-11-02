"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/app/field";
import { LATE_RULE, applyLateFees, saveLateRule, useFeesStore } from "@/lib/fees-setup";
import { formatINR, todayOnIST } from "@/lib/time";
import { usePending } from "@/lib/use-pending";

export function LateFeeTab() {
  useFeesStore();
  const [enabled, setEnabled] = React.useState(LATE_RULE.enabled);
  const [grace, setGrace] = React.useState(String(LATE_RULE.graceDays));
  const [amount, setAmount] = React.useState(String(LATE_RULE.amountPaise / 100));
  const [per, setPer] = React.useState<"once" | "day">(LATE_RULE.per);
  const [max, setMax] = React.useState(String(LATE_RULE.maxPaise / 100));
  const [error, setError] = React.useState("");
  const { run, is } = usePending();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const g = Number(grace), a = Number(amount), m = Number(max || 0);
    if (!Number.isInteger(g) || g < 0 || g > 60) return setError("Grace days must be a whole number from 0 to 60");
    if (!(a > 0)) return setError("Enter a late fee amount greater than zero");
    if (!(m >= 0)) return setError("The maximum cannot be negative");
    if (m > 0 && m < a) return setError("The maximum must be at least the late fee amount (or 0 for no limit)");
    setError("");
    run("save", () => { saveLateRule({ enabled, graceDays: g, amountPaise: Math.round(a * 100), per, maxPaise: Math.round(m * 100) }); toast.success("Saved"); });
  }
  const example = per === "once" ? `${formatINR(Math.round(Number(amount || 0) * 100))} once, after ${grace || 0} days` : `${formatINR(Math.round(Number(amount || 0) * 100))} for every day after ${grace || 0} days${Number(max) > 0 ? `, up to ${formatINR(Math.round(Number(max) * 100))}` : ""}`;
  return (
    <Card className="max-w-2xl">
      <CardHeader><div><CardTitle>Late fee</CardTitle></div></CardHeader>
      <form onSubmit={save} className="flex flex-col gap-5">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-fill px-4 py-3 text-sm font-medium">
          Charge late fees
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Charge late fees" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grace days" htmlFor="lf-grace"><Input id="lf-grace" inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value)} disabled={!enabled} /></Field>
          <Field label="Late fee (₹)" htmlFor="lf-amount"><Input id="lf-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!enabled} /></Field>
          <Field label="Charged" htmlFor="lf-per"><NativeSelect id="lf-per" value={per} onChange={(e) => setPer(e.target.value as "once" | "day")} disabled={!enabled}>
            <option value="once">Once</option><option value="day">Daily</option></NativeSelect></Field>
          <Field label="Cap (₹)" htmlFor="lf-max"><Input id="lf-max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} disabled={!enabled} /></Field>
        </div>
        <p className="rounded-xl bg-fill px-4 py-3 text-sm text-muted-foreground">{enabled ? example : "Off"}</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="brand" loading={is("save")}>Save</Button>
          <Button type="button" variant="secondary" loading={is("apply")} onClick={() => run("apply", () => { const n = applyLateFees(todayOnIST()); toast.success(n ? `Updated ${n}` : "Nothing to add"); })}>Apply now</Button>
        </div>
      </form>
    </Card>
  );
}
