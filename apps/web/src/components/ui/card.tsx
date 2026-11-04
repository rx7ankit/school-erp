import * as React from "react";
import { cn } from "@/lib/utils";

/** Flat card with a hairline edge so it reads in light and dark. No shadow. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-[24px] border border-border/50 bg-card p-6 text-card-foreground", className)} {...props} />;
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("mb-6 flex flex-wrap items-start justify-between gap-3", className)} {...props} />;
}
function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-[18px] font-bold tracking-[-0.02em]", className)} {...props} />;
}
function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("mt-0.5 text-[13px] text-text-tertiary", className)} {...props} />;
}
export { Card, CardHeader, CardTitle, CardDescription };
