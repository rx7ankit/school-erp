import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Native <select> styled to match Input. Best on mobile, zero JS. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="select"
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border-0 bg-fill pl-4 pr-10 text-sm text-foreground transition-colors focus-visible:bg-separator/50 disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
    </div>
  );
}
export { NativeSelect };
