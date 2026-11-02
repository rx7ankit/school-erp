"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTr } from "@/lib/lang-context";

const EVT = "krevo:theme";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb); };
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};

export function ThemeToggle() {
  const tr = useTr();
  const dark = React.useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("krevo.theme", next); } catch {}
    window.dispatchEvent(new Event(EVT));
  };
  return (
    <Button variant="secondary" size="icon" onClick={toggle} aria-label={dark ? tr("theme.light", "Switch to light theme") : tr("theme.dark", "Switch to dark theme")}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
