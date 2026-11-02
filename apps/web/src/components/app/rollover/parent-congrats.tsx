"use client";
import * as React from "react";
import { GraduationCap, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { daysBetween } from "@/lib/rollover-draft";
import { useNotifications } from "@/lib/notifications";
import { useNotifText, useT } from "@/lib/parent-i18n";
import { todayOnIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const KEY = "scool.congrats.dismissed";
const EVT = "scool:congrats";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

/** Home card for 14 days after year-end, driven by the promotion notification. Dismissible. */
export function CongratsCard({ studentId }: { studentId: string }) {
  const t = useT(), notifText = useNotifText();
  const { items } = useNotifications([studentId]);
  const dismissedRaw = React.useSyncExternalStore(subscribe, read, () => "");
  const today = useTodayIST();
  if (!today) return null;
  let dismissed: string[] = [];
  try { dismissed = dismissedRaw ? (JSON.parse(dismissedRaw) as string[]) : []; } catch {}
  const n = items.find((x) => x.type.startsWith("promotion_"));
  if (!n || dismissed.includes(n.id) || daysBetween(todayOnIST(new Date(n.at)), today) > 14) return null;
  const text = notifText(n);
  const dismiss = () => { try { localStorage.setItem(KEY, JSON.stringify([...dismissed, n.id])); } catch {} window.dispatchEvent(new Event(EVT)); };
  return (
    <Card className="flex items-start gap-4 bg-accent-subtle" role="status" aria-label={t("cg.label")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-brand"><GraduationCap className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="font-bold">{text.title}</p><p className="text-sm text-muted-foreground">{text.body}</p></div>
      <button type="button" onClick={dismiss} aria-label={t("cg.dismiss")} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-card"><X className="size-4" /></button>
    </Card>
  );
}
