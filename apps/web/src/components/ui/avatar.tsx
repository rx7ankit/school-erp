import * as React from "react";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ name, className, ...props }: { name: string } & React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar"
      aria-hidden
      className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-fill text-[13px] font-bold text-muted-foreground", className)}
      {...props}
    >
      {initials(name)}
    </div>
  );
}
export { Avatar };
