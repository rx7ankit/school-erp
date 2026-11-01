import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border-0 bg-fill px-4 text-sm text-foreground placeholder:text-text-tertiary transition-colors focus-visible:bg-separator/50 disabled:opacity-50 aria-invalid:bg-danger/10",
        className,
      )}
      {...props}
    />
  );
}
export { Input };
