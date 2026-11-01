"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { allSubjectNames, keyLabel, setSubjectOn, subjectsOf } from "@/lib/rollover";
import type { StepProps } from "./step-props";

/** New classes by subjects. Prefilled from the same grade this year; a brand new subject can be added inline. */
export function SubjectGrid({ draft, plan, update }: StepProps) {
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const names = allSubjectNames(draft);
  const keys = plan.classes.map((c) => c.key);
  function add() {
    const n = name.trim(), c = (code.trim() || n.slice(0, 3)).toUpperCase();
    if (!n) return setError("Give the subject a name.");
    if (names.some((x) => x.toLowerCase() === n.toLowerCase())) return setError(`${n} already exists.`);
    if (!/^[A-Za-z0-9]{2,5}$/.test(c)) return setError("Code is 2 to 5 letters or digits.");
    setError(""); setName(""); setCode("");
    update((d) => setSubjectOn({ ...d, newSubjects: [...d.newSubjects, { name: n, code: c }] }, keys, n, true));
  }
  return (
    <Card>
      <CardHeader><div><CardTitle>Subjects</CardTitle><CardDescription>Ticked from the same grade this year. Untick what a class does not study.</CardDescription></div></CardHeader>
      <div className="overflow-x-auto">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              {names.map((n) => <TableHead key={n} className="text-center">{n}{draft.newSubjects.some((s) => s.name === n) && <Badge tone="brand" className="ml-1.5">New</Badge>}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.classes.map((c) => {
              const mine = subjectsOf(draft, c.key);
              return (
                <TableRow key={c.key}>
                  <TableCell className="font-medium">Class {keyLabel(c.key)}</TableCell>
                  {names.map((n) => (
                    <TableCell key={n} className="text-center">
                      <Checkbox className="mx-auto" aria-label={`${n} in class ${keyLabel(c.key)}`} checked={mine.includes(n)} onCheckedChange={(v) => update((d) => setSubjectOn(d, [c.key], n, v === true))} />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <form className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Field label="Add a new subject" htmlFor="ro-sub-name"><Input id="ro-sub-name" className="w-52" placeholder="Art" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Code" htmlFor="ro-sub-code"><Input id="ro-sub-code" className="w-24" placeholder="ART" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Button type="submit" variant="secondary"><Plus /> Add to all classes</Button>
        {error && <p role="alert" className="pb-2.5 text-xs text-danger">{error}</p>}
      </form>
    </Card>
  );
}
