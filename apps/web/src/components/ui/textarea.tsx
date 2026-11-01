import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-text-tertiary disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
export { Textarea };
