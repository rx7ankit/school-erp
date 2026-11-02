"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { setClassSubjects, type SetupClass, type Subject } from "@/lib/academic-setup";
import { className } from "@/lib/mock";

/** Subjects x sections for one grade, with "all sections" ticks and a select-all-for-this-grade shortcut. */
export function SubjectClassGrid({ title, sections, subjects, classSubjects }: {
  title: string; sections: SetupClass[]; subjects: Subject[]; classSubjects: Record<string, string[]>;
}) {
  const ids = sections.map((c) => c.id);
  const has = (c: string, s: string) => (classSubjects[c] ?? []).includes(s);
  const allTicked = subjects.length > 0 && subjects.every((s) => ids.every((c) => has(c, s.id)));
  return (
    <section aria-label={title} className="rounded-2xl bg-fill/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold">{title}</h4>
        <Button size="sm" variant="secondary" onClick={() => setClassSubjects(ids, subjects.map((s) => s.id), !allTicked)}>{allTicked ? "Clear all" : "Select all"}</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Subject</th>
              {sections.length > 1 && <th className="px-3 py-1.5 text-center font-medium">All sections</th>}
              {sections.map((c) => <th key={c.id} className="px-3 py-1.5 text-center font-medium">{className(c.id)}</th>)}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => {
              const n = ids.filter((c) => has(c, s.id)).length;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{s.name}</td>
                  {sections.length > 1 && (
                    <td className="px-3 py-2"><div className="grid place-items-center">
                      <Checkbox aria-label={`${s.name} for every section of ${title}`} checked={n === ids.length ? true : n === 0 ? false : "indeterminate"} onCheckedChange={() => setClassSubjects(ids, [s.id], n !== ids.length)} />
                    </div></td>
                  )}
                  {sections.map((c) => (
                    <td key={c.id} className="px-3 py-2"><div className="grid place-items-center">
                      <Checkbox aria-label={`${s.name} for class ${className(c.id)}`} checked={has(c.id, s.id)} onCheckedChange={(on) => setClassSubjects([c.id], [s.id], on === true)} />
                    </div></td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
