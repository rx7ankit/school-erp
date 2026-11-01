import { cn } from "@/lib/utils";

/** Two-tone heading: ink title, grey continuation. */
export function PageHeader({ eyebrow, title, dim, actions, className }: {
  eyebrow?: string; title: string; dim?: string; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-xl">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{eyebrow}</p>}
        <h1 className="text-[28px] leading-[1.1] tracking-[-0.025em] sm:text-[34px]">
          {title} {dim && <span className="dim">{dim}</span>}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
