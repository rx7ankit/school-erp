import * as React from "react";
import { cn } from "@/lib/utils";

/** Flat grey card. No border, no shadow. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-[20px] bg-card p-6 text-card-foreground", className)} {...props} />;
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("mb-5 flex flex-wrap items-start justify-between gap-3", className)} {...props} />;
}
function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-[17px] font-bold tracking-tight", className)} {...props} />;
}
function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-[13px] text-muted-foreground", className)} {...props} />;
}
export { Card, CardHeader, CardTitle, CardDescription };
