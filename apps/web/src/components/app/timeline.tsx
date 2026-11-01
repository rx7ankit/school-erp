import { cn } from "@/lib/utils";

export interface TimelineItem { id: string; title: string; detail?: string; when: string; tone?: "brand" | "danger" | "neutral"; }

/** Vertical history list. Newest first. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((it, i) => (
        <li key={it.id} className="relative flex gap-4 pb-6 last:pb-0">
          {i < items.length - 1 && <span className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-border" aria-hidden />}
          <span className={cn("mt-1.5 size-[15px] shrink-0 rounded-full border-[3px] border-card bg-text-tertiary", it.tone === "brand" && "bg-brand", it.tone === "danger" && "bg-danger")} />
          <div className="min-w-0">
            <p className="font-medium">{it.title}</p>
            {it.detail && <p className="text-[13px] text-muted-foreground">{it.detail}</p>}
            <p className="mt-0.5 text-xs text-text-tertiary tabular-nums">{it.when}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
