import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A headline number. `solid` makes it the dark card of the row (use on one card only), `icon` adds a round chip.
 * The dark card keeps its own fixed colours so it reads the same in light and dark mode.
 */
export function StatCard({ label, value, hint, icon: Icon, solid = false }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; solid?: boolean }) {
  return (
    <Card className={cn("relative flex flex-col gap-4 overflow-hidden p-5", solid && "bg-[linear-gradient(160deg,#2C2C2F,#18181A)] text-[#fff]")}>
      {solid && <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.14),transparent)]" />}
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-[13px] font-medium", solid ? "text-[#fff]/60" : "text-text-secondary")}>{label}</span>
        {Icon && (
          <span className={cn("grid size-9 place-items-center rounded-full", solid ? "bg-[#fff]/10 text-[#fff]" : "bg-bg text-text-secondary")}>
            <Icon className="size-[18px]" strokeWidth={1.8} />
          </span>
        )}
      </div>
      <div>
        <div className="text-[34px] font-bold leading-none tracking-[-0.035em] tabular-nums">{value}</div>
        {hint && <div className={cn("mt-2 text-[13px]", solid ? "text-[#fff]/55" : "text-text-tertiary")}>{hint}</div>}
      </div>
    </Card>
  );
}
