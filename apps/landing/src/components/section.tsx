import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SectionHeading } from "@/components/section-heading";

type SectionProps = {
  id: string;
  title: string;
  dim: string;
  line?: string;
  left?: boolean;
  children?: ReactNode;
  className?: string;
};

/** Page section: anchor, landmark, and a short two-tone heading (2-4 words) with at most one short line. */
export function Section({ id, title, dim, line, left = false, children, className }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("px-4 py-14 sm:px-6 md:py-20", className)}>
      <div className="mx-auto w-full max-w-[1200px]">
        <SectionHeading id={id} title={title} dim={dim} line={line} left={left} />
        {children}
      </div>
    </section>
  );
}
