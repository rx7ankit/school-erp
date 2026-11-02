"use client";
import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn("inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-separator p-0.5 transition-colors data-[state=checked]:bg-solid", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 rounded-full bg-background transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}
export { Switch };
