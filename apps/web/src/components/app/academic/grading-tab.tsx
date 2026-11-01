"use client";
import * as React from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEFAULT_SCHEME, saveScheme, validateScheme, useAcademic, type GradingScheme } from "@/lib/academic-setup";
import { usePending } from "@/lib/use-pending";

/** Editable grade bands. Draft is local until Save. */
export function GradingTab() {
  const { scheme } = useAcademic();
  const { run, is } = usePending(600);
  const [draft, setDraft] = React.useState<GradingScheme>(scheme);
  const [minTxt, setMinTxt] = React.useState<string[]>(scheme.bands.map((b) => String(b.min)));
  const [passTxt, setPassTxt] = React.useState(String(scheme.passPercent));
  const [showErr, setShowErr] = React.useState(false);

  const parsed: GradingScheme = { ...draft, bands: draft.bands.map((b, i) => ({ ...b, min: minTxt[i] === "" ? NaN : Number(minTxt[i]) })), passPercent: passTxt === "" ? NaN : Number(passTxt) };
  const error = validateScheme(parsed);
  const dirty = JSON.stringify(parsed) !== JSON.stringify(scheme);
  const load = (s: GradingScheme) => { setDraft(s); setMinTxt(s.bands.map((b) => String(b.min))); setPassTxt(String(s.passPercent)); setShowErr(false); };

  function setBand(i: number, patch: Partial<{ grade: string }>) { setDraft((d) => ({ ...d, bands: d.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) })); }
  function addBand() {
    const last = Number(minTxt.at(-1) ?? 50);
    const next = Math.max(1, Math.floor((Number.isFinite(last) ? last : 50) / 2));
    setDraft((d) => ({ ...d, bands: [...d.bands, { min: next, grade: "" }] })); setMinTxt((m) => [...m, String(next)]);
  }
  function removeBand(i: number) { setDraft((d) => ({ ...d, bands: d.bands.filter((_, j) => j !== i) })); setMinTxt((m) => m.filter((_, j) => j !== i)); }

  return (
    <Card className="flex flex-col gap-5">
      <CardHeader className="mb-0">
        <div><CardTitle>Grading scheme</CardTitle><CardDescription>A student gets the first band whose minimum percent they reach. List bands from highest to lowest.</CardDescription></div>
        <Button size="sm" variant="secondary" onClick={() => load(DEFAULT_SCHEME)}><RotateCcw /> Reset to default</Button>
      </CardHeader>
      <ul className="flex flex-col gap-2">
        {draft.bands.map((b, i) => (
          <li key={i} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 sm:grid-cols-[6rem_13rem_auto]">
            <Input aria-label={`Grade name for band ${i + 1}`} placeholder="Grade" value={b.grade} maxLength={4} onChange={(e) => setBand(i, { grade: e.target.value })} aria-invalid={showErr && !b.grade.trim()} />
            <div className="flex items-center gap-2"><Input aria-label={`Minimum percent for ${b.grade || `band ${i + 1}`}`} inputMode="numeric" value={minTxt[i] ?? ""} onChange={(e) => setMinTxt((m) => m.map((x, j) => (j === i ? e.target.value : x)))} /><span className="whitespace-nowrap text-sm text-muted-foreground">% and above</span></div>
            <Button size="icon-sm" variant="ghost" aria-label={`Remove band ${b.grade || i + 1}`} onClick={() => removeBand(i)}><Trash2 /></Button>
          </li>
        ))}
        <li className="grid grid-cols-[5rem_1fr] items-center gap-3 sm:grid-cols-[6rem_13rem_auto]">
          <Input aria-label="Grade below the lowest band" value={draft.floorGrade} maxLength={4} onChange={(e) => setDraft((d) => ({ ...d, floorGrade: e.target.value }))} />
          <span className="text-sm text-muted-foreground">Below {minTxt.at(-1) || "the lowest band"}%</span>
        </li>
      </ul>
      <div><Button size="sm" variant="secondary" onClick={addBand}><Plus /> Add band</Button></div>
      <div className="max-w-xs"><Field label="Pass percent" htmlFor="pass" hint="Overall percentage a student needs to pass"><Input id="pass" inputMode="numeric" value={passTxt} onChange={(e) => setPassTxt(e.target.value)} /></Field></div>
      {showErr && error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2.5">
        <Button variant="secondary" disabled={!dirty} onClick={() => load(scheme)}>Discard changes</Button>
        <Button variant="brand" loading={is("scheme")} disabled={!dirty} onClick={() => { if (error) { setShowErr(true); return; } run("scheme", () => { saveScheme(parsed); toast.success("Grading scheme saved", { description: "New grades apply to every report from now on." }); }); }}>Save scheme</Button>
      </div>
    </Card>
  );
}
