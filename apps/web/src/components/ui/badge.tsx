import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1.5 rounded-full bg-fill px-2.5 text-xs font-medium before:size-1.5 before:rounded-full before:bg-current",
  {
    variants: {
      tone: {
        neutral: "text-muted-foreground",
        success: "text-success",
        warning: "text-warning",
        danger: "text-danger",
        brand: "text-brand",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}
export { Badge };
