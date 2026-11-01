"use client";
import * as React from "react";
import { useSession } from "@/components/session-provider";
import type { Student } from "@/lib/mock";

const KEY = "scool.child";
const EVT = "scool:child";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

/** The parent's currently selected child. Persists across visits. One email can own several children. */
export function useChild(): { child: Student; children: Student[]; select: (id: string) => void } | null {
  const { parent } = useSession();
  const saved = React.useSyncExternalStore(subscribe, read, () => "");
  if (!parent) return null;
  const child = parent.children.find((c) => c.id === saved) ?? parent.children[0];
  return { child, children: parent.children, select: (id) => { try { localStorage.setItem(KEY, id); } catch {} window.dispatchEvent(new Event(EVT)); } };
}
