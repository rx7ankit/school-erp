"use client";
import * as React from "react";
import { useSession } from "@/components/session-provider";
import { className, type Student } from "@/lib/mock";

const KEY = "scool.child";
const EVT = "scool:child";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

/** A child as the parent portal shows them. `classLabel` is "8-A" (from the API when live), `readOnly` is a child who has left. */
export type ParentChild = Student & { classLabel: string; readOnly: boolean };

/** The parent's currently selected child. Persists across visits. One email can own several children. */
export function useChild(): { child: ParentChild; children: ParentChild[]; select: (id: string) => void } | null {
  const { parent, me, live } = useSession();
  const saved = React.useSyncExternalStore(subscribe, read, () => "");
  const kids = React.useMemo<ParentChild[]>(() => {
    if (!parent) return [];
    const brief = new Map((me?.children ?? []).map((c) => [c.student_id, c]));
    return parent.children.map((c) => ({
      ...c,
      classLabel: live ? brief.get(c.id)?.class_label ?? "" : className(c.classId),
      readOnly: live ? !!brief.get(c.id)?.read_only : c.status !== "active",
    }));
  }, [parent, me, live]);
  if (!parent || kids.length === 0) return null;
  const child = kids.find((c) => c.id === saved) ?? kids[0];
  return { child, children: kids, select: (id) => { try { localStorage.setItem(KEY, id); } catch {} window.dispatchEvent(new Event(EVT)); } };
}
