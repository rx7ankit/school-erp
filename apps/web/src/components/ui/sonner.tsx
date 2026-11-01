"use client";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-border !bg-popover !text-foreground !shadow-none",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
