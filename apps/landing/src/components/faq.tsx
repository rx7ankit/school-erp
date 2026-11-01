"use client";

import { useId, useState } from "react";
import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type FaqItem = { question: string; answer: string };

/** Accessible disclosure list: each question is a button controlling its answer region. */
export function Faq({ items }: { items: readonly FaqItem[] }) {
  const base = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());

  function toggle(index: number) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, index) => {
        const isOpen = open.has(index);
        const buttonId = `${base}-q${index}`;
        const panelId = `${base}-a${index}`;
        return (
          <li key={item.question} className="rounded-[20px] bg-card">
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className="flex w-full items-center justify-between gap-4 rounded-[20px] px-5 py-5 text-left text-[17px] font-bold tracking-[-0.01em] text-text focus-visible:outline-2 sm:px-6"
              >
                <span>{item.question}</span>
                <PlusIcon
                  className={cn("size-5 text-text-secondary transition-transform duration-200 motion-reduce:transition-none", isOpen && "rotate-45")}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5 text-[16px] leading-[1.6] text-text-secondary sm:px-6"
            >
              {item.answer}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
