import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { InView } from "@/components/in-view";

type SectionProps = {
  id: string;
  title: string;
  line?: string;
  /** Left-align the heading (for split layouts). */
  left?: boolean;
  children?: ReactNode;
  className?: string;
};

/** Page section: anchor, landmark, and a short heading (2-4 words) with at most one short line. */
export function Section({ id, title, line, left = false, children, className }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("px-4 py-14 sm:px-6 md:py-20", className)}>
      <div className="mx-auto w-full max-w-[1200px]">
        {children ? (
          <>
            <SectionHead id={id} title={title} line={line} left={left} />
            {children}
          </>
        ) : null}
      </div>
    </section>
  );
}

export function SectionHead({ id, title, line, left = false }: { id: string; title: string; line?: string; left?: boolean }) {
  return (
    <InView reveal className={cn("mb-10 md:mb-14", left ? "text-left" : "mx-auto text-center")}>
      <h2 id={`${id}-h`} className="text-[clamp(2.1rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.03em]">
        {title}
      </h2>
      {line ? <p className={cn("mt-3 text-[clamp(1.05rem,1.6vw,1.25rem)] leading-snug text-text-secondary", !left && "mx-auto max-w-xl")}>{line}</p> : null}
    </InView>
  );
}
