"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";

/** Rupee input that lets you clear and retype. `paise` is the value in the draft; while typing the text you typed is shown. */
export function AmountCell({ label, paise, onValue }: { label: string; paise: number; onValue: (paise: number) => void }) {
  const [typed, setTyped] = React.useState<string | null>(null);
  return (
    <Input aria-label={label} inputMode="decimal" className="ml-auto h-9 w-24 bg-card text-right tabular-nums" value={typed ?? String(paise / 100)}
      onFocus={(e) => { setTyped(e.target.value); e.target.select(); }} onBlur={() => setTyped(null)}
      onChange={(e) => { setTyped(e.target.value); const n = Number(e.target.value || 0); if (Number.isFinite(n) && n >= 0) onValue(Math.round(n * 100)); }} />
  );
}
