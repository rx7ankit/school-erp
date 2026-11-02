"use client";
/**
 * The rollover draft lives in localStorage, so any academic manager can resume it from any tab.
 * One active draft per school. Nothing changes in the school until applyRollover().
 */
import * as React from "react";
import { currentYear } from "./academic-setup";
import { nowUTC } from "./time";
import type { RolloverDraft } from "./rollover-types";

const KEY = "slov.rollover.draft";
const EVT = "slov:rollover";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const raw = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

function parse(s: string): RolloverDraft | null {
  try {
    const d = s ? (JSON.parse(s) as RolloverDraft) : null;
    // A draft made for a year that is no longer current is stale.
    return d && d.version === 1 && d.fromYearId === currentYear().id ? d : null;
  } catch { return null; }
}
export const getDraft = (): RolloverDraft | null => parse(raw());
/** The saved draft, or null. Re-renders when any tab saves or closes it. */
export function useSavedDraft(): RolloverDraft | null {
  const s = React.useSyncExternalStore(subscribe, raw, () => "");
  return React.useMemo(() => parse(s), [s]);
}
export function saveDraft(d: RolloverDraft, by: string): RolloverDraft {
  const next = { ...d, savedAt: nowUTC(), savedBy: by };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event(EVT));
  return next;
}
export function clearDraft() {
  try { localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new Event(EVT));
}

/** Days from `fromOn` to `toOn` (calendar dates). */
export const daysBetween = (fromOn: string, toOn: string) => Math.round((Date.parse(`${toOn}T00:00:00Z`) - Date.parse(`${fromOn}T00:00:00Z`)) / 86_400_000);

/** True from 45 days before the year end. */
export const yearEndIsNear = (todayOn: string): boolean => {
  const left = daysBetween(todayOn, currentYear().toOn);
  return left <= 45 && left > -400;
};

/** Reads a flag such as ?rollover from the address bar (empty on the server). */
const noop = () => () => {};
export function useQueryFlag(name: string): boolean {
  return React.useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).has(name), () => false);
}

/** Reads a query value such as ?class=c8a from the address bar (null on the server). */
export function useQueryParam(name: string): string | null {
  return React.useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get(name), () => null);
}
