"use client";
import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";
const EVT = "krevo:theme";
const KEY = "krevo.theme";

const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
};
const read = (): Mode => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
};

const TABS = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
] as const;

/** Light / Dark / System as a small segmented tab bar. Same storage key the rest of the app uses. */
export function ThemeTabs({ className }: { className?: string }) {
  const mode = React.useSyncExternalStore(subscribe, read, () => "system" as Mode);
  const pick = (next: Mode) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event(EVT));
  };
  return (
    <div role="tablist" aria-label="Theme" className={cn("inline-flex items-center gap-0.5 rounded-full bg-card p-1", className)}>
      {TABS.map(({ id, label, Icon }) => {
        const on = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={label}
            title={label}
            onClick={() => pick(id)}
            className={cn(
              "grid size-8 place-items-center rounded-full transition-colors",
              on ? "bg-bg text-text" : "text-text-tertiary hover:text-text",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
