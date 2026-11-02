import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";
/** Portal chips are grey with ink text; only the tiny leading dot carries the status colour. */
const DOT: Record<Tone, string> = {
  neutral: "before:bg-text-tertiary", brand: "before:bg-text-tertiary",
  success: "before:bg-success", warning: "before:bg-warning", danger: "before:bg-danger",
};
export function StatusBadge({ tone = "neutral", className, ...props }: { tone?: Tone | null } & Omit<React.ComponentProps<typeof Badge>, "tone">) {
  return <Badge tone="neutral" className={cn("text-foreground", DOT[tone ?? "neutral"], className)} {...props} />;
}
