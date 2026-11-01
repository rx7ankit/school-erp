import type { ReactNode } from "react";
import { Heading } from "@/components/heading";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

type FeatureRowProps = {
  id: string;
  eyebrow: string;
  lead: string;
  dim: string;
  body: string;
  points: readonly string[];
  /** Decorative product mockup. Rendered inside a flat grey stage. */
  visual: ReactNode;
  /** Put the mockup on the left on large screens. */
  flip?: boolean;
};

/** One feature explainer: text on one side, mockup on the other. */
export function FeatureRow({ id, eyebrow, lead, dim, body, points, visual, flip = false }: FeatureRowProps) {
  const headingId = `${id}-heading`;
  return (
    <article aria-labelledby={headingId} className="grid items-center gap-8 py-10 lg:grid-cols-2 lg:gap-16 lg:py-14">
      <div className={cn(flip && "lg:order-2")}>
        <p className="mb-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{eyebrow}</p>
        <Heading as="h3" id={headingId} lead={lead} dim={dim} size="title" className="text-[clamp(1.75rem,3.6vw,2.75rem)]" />
        <p className="mt-5 max-w-xl text-[17px] leading-[1.6] text-text-secondary">{body}</p>
        <ul className="mt-6 flex max-w-xl flex-col gap-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-[16px] leading-[1.5] text-text">
              <CheckIcon className="mt-0.5 size-5 text-text-secondary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("min-w-0 rounded-[28px] bg-card p-3 sm:p-6", flip && "lg:order-1")}>{visual}</div>
    </article>
  );
}
