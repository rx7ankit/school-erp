import { cn } from "@/lib/utils";

/** Two-tone heading: ink title, grey continuation. Short on purpose: three words at most, no eyebrow. */
export function PageHeader({ eyebrow, title, dim, actions, className }: {
  eyebrow?: string; title: string; dim?: string; actions?: React.ReactNode; className?: string;
}) {
  void eyebrow;
  const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
  const shortDim = dim && words(title) + words(dim) <= 3 ? dim : undefined;
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-xl">
        <h1 className="text-[28px] leading-[1.1] tracking-[-0.025em] sm:text-[34px]">
          {title} {shortDim && <span className="dim">{shortDim}</span>}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
