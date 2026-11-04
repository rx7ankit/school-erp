"use client";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border-0 !bg-popover !text-foreground pop-shadow",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
