import { Reveal, WordReveal } from "@/components/motion";
import { cn } from "@/lib/cn";

/** Section heading in the reference style: big two-tone words that slide up, one calm line underneath. */
export function Heading({ id, title, dim, line, left = false, className }: { id: string; title: string; dim: string; line?: string; left?: boolean; className?: string }) {
  return (
    <div className={cn(left ? "text-left" : "mx-auto text-center", className)}>
      <WordReveal
        as="h2"
        id={`${id}-h`}
        title={title}
        dim={dim}
        className="text-[clamp(2.5rem,6vw,4.6rem)] font-bold leading-[1.02] tracking-[-0.045em]"
      />
      {line ? (
        <Reveal as="p" delay={350} y={14} className={cn("mt-4 text-[clamp(1.05rem,1.6vw,1.25rem)] leading-snug text-text-secondary", !left && "mx-auto max-w-xl")}>
          {line}
        </Reveal>
      ) : null}
    </div>
  );
}
