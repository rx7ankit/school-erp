import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionProps = {
  id: string;
  /** Id of the heading inside, for the landmark name. */
  labelledBy: string;
  /** Wrap the content in a rounded grey panel. */
  panel?: boolean;
  className?: string;
  children: ReactNode;
};

/** Page section: anchor target, landmark, consistent width and rhythm. */
export function Section({ id, labelledBy, panel = false, className, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={labelledBy} className="px-4 py-12 sm:px-6 md:py-16">
      <div
        className={cn(
          "mx-auto w-full max-w-[1200px]",
          panel && "rounded-[28px] bg-card px-5 py-12 sm:px-10 md:px-14 md:py-20",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Small orange-free eyebrow label above a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{children}</p>;
}
