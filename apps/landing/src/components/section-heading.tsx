import { InView } from "@/components/in-view";
import { cn } from "@/lib/cn";

/** Two-tone title: the first part in ink, the continuation in grey (`.dim`). Used by the site and the deck. */
export function TwoTone({ title, dim, block = false }: { title: string; dim: string; block?: boolean }) {
  return (
    <>
      <span className={block ? "block" : undefined}>{title}</span> <span className={cn("dim", block && "block")}>{dim}</span>
    </>
  );
}

/** The one section heading: black first, grey after, with at most one short line. */
export function SectionHeading({
  id,
  title,
  dim,
  line,
  left = false,
  as: Tag = "h2",
  className,
}: {
  id: string;
  title: string;
  dim: string;
  line?: string;
  left?: boolean;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <InView reveal className={cn("mb-10 md:mb-14", left ? "text-left" : "mx-auto text-center", className)}>
      <Tag id={`${id}-h`} className="text-[clamp(2.1rem,5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.03em]">
        <TwoTone title={title} dim={dim} />
      </Tag>
      {line ? <p className={cn("mt-3 text-[clamp(1.05rem,1.6vw,1.25rem)] leading-snug text-text-secondary", !left && "mx-auto max-w-xl")}>{line}</p> : null}
    </InView>
  );
}
