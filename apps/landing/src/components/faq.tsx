"use client";

import { useId, useState } from "react";
import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type FaqItem = { readonly q: string; readonly a: string };

/** Accessible disclosure list: each question is a button controlling its answer region. */
export function Faq({ items }: { items: readonly FaqItem[] }) {
  const base = useId();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, index) => {
        const isOpen = open === index;
        const buttonId = `${base}-q${index}`;
        const panelId = `${base}-a${index}`;
        return (
          <li key={item.q} className="rounded-[22px] bg-card">
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex min-h-16 w-full items-center justify-between gap-4 rounded-[22px] px-5 py-4 text-left text-[18px] font-bold tracking-[-0.01em] text-text focus-visible:outline-2 sm:px-6"
              >
                <span>{item.q}</span>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full transition-colors", isOpen ? "bg-accent text-on-accent" : "bg-fill text-text-secondary")}>
                  <PlusIcon className={cn("size-4 transition-transform duration-300 motion-reduce:transition-none", isOpen && "rotate-45")} />
                </span>
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen} className="px-5 pb-5 text-[16px] leading-[1.5] text-text-secondary sm:px-6">
              {item.a}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
