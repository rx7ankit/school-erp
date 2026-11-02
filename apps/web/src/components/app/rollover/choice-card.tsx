"use client";
import { cn } from "@/lib/utils";

/** A radio-style choice shown as a flat card. Used for the "pick one" decisions in the wizard. */
export function ChoiceGroup<T extends string>({ label, value, onChange, options, className }: {
  label: string; value: T; onChange: (v: T) => void; className?: string;
  options: { value: T; title: string; text?: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2.5", options.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cn("flex cursor-pointer flex-col gap-1 rounded-2xl p-4 text-left transition-colors", on ? "bg-accent-subtle ring-2 ring-brand" : "bg-fill hover:bg-separator/60")}>
            <span className="flex items-center gap-2 text-sm font-bold">
              <i className={cn("grid size-4 shrink-0 place-items-center rounded-full", on ? "bg-brand" : "bg-separator")}>{on && <i className="size-1.5 rounded-full bg-white" />}</i>
              {o.title}
            </span>
            {o.text && <span className="text-[13px] text-muted-foreground">{o.text}</span>}
          </button>
        );
      })}
    </div>
  );
}
