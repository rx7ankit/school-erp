"use client";
import * as React from "react";
import { SUBJECTS } from "./mock";

export interface ExamPaper { subject: string; dateOn: string; time: string; }   // dateOn = IST calendar date, time = "HH:mm" IST
export interface ExamSheet { id: string; name: string; classIds: string[]; papers: ExamPaper[]; createdAt: string; }

const KEY = "scool.examsheets";
const EVT = "scool:examsheets";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const raw = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

const SEED: ExamSheet[] = [{
  id: "es1", name: "Half-yearly exams", classIds: ["c6a", "c7a", "c8a", "c8b", "c9a", "c10a"], createdAt: "2026-10-28T08:30:00Z",
  papers: SUBJECTS.map((s, i) => ({ subject: s, dateOn: `2026-11-${String(23 + i * 2).padStart(2, "0")}`, time: "09:00" })),
}];

export function useExamSheets(): ExamSheet[] {
  const stored = React.useSyncExternalStore(subscribe, raw, () => "");
  return React.useMemo(() => { try { return [...(stored ? (JSON.parse(stored) as ExamSheet[]) : []), ...SEED]; } catch { return SEED; } }, [stored]);
}
export function addExamSheet(sheet: ExamSheet) {
  let cur: ExamSheet[] = [];
  try { cur = JSON.parse(raw() || "[]"); } catch {}
  try { localStorage.setItem(KEY, JSON.stringify([sheet, ...cur])); } catch {}
  window.dispatchEvent(new Event(EVT));
}
/** "09:00" to "9:00 am". Times are school (IST) clock times, never converted. */
export const clock = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
