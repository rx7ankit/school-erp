import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Flat phone bezel for the parent app mockups. Decorative only. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("w-[270px] max-w-full shrink-0 select-none rounded-[44px] bg-solid p-[9px]", className)}>
      <div className="relative flex h-[540px] flex-col overflow-hidden rounded-[36px] bg-bg text-text">
        <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold">
          <span>10:42</span>
          <span className="absolute left-1/2 top-2 h-[18px] w-[72px] -translate-x-1/2 rounded-full bg-solid" />
          <span className="flex items-center gap-1">
            <span className="h-2 w-3.5 rounded-[2px] bg-text" />
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        <div className="mx-auto mb-2 mt-1 h-1 w-24 rounded-full bg-text" />
      </div>
    </div>
  );
}
