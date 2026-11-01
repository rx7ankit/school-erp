import { cn } from "@/lib/cn";

type HeadingProps = {
  as?: "h1" | "h2" | "h3";
  /** First phrase, in ink. */
  lead: string;
  /** Second phrase, in grey. */
  dim?: string;
  size?: "display" | "title" | "sub";
  id?: string;
  className?: string;
};

const sizes = {
  display: "text-[clamp(2.5rem,7.4vw,5.5rem)] leading-[1.04] tracking-[-0.035em]",
  title: "text-[clamp(2rem,4.6vw,3.5rem)] leading-[1.08] tracking-[-0.03em]",
  sub: "text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.15] tracking-[-0.02em]",
};

/** Two-tone heading: the lead phrase in ink, the rest in grey (`.dim`). */
export function Heading({ as: Tag = "h2", lead, dim, size = "title", id, className }: HeadingProps) {
  return (
    <Tag id={id} className={cn("font-bold", sizes[size], className)}>
      {lead}
      {dim ? (
        <>
          {" "}
          <span className="dim">{dim}</span>
        </>
      ) : null}
    </Tag>
  );
}
