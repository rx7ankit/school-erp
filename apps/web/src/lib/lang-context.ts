"use client";
/**
 * The bridge between the parent portal's translations and components that staff also use.
 * It holds NO dictionaries: only the parent layout's LanguageProvider (lib/parent-i18n.tsx) puts a
 * value here. Outside the parent portal there is no provider, so everything falls back to the English
 * text written at the call site and the staff app never loads Hindi.
 */
import * as React from "react";
import { formatDateOn, formatIST } from "@/lib/time";
import type { TKey } from "@/lib/parent-i18n"; // type only: erased at build time

export type Lang = "en" | "hi";
export type Vars = Record<string, string | number>;
export interface LangValue {
  lang: Lang;
  t: (key: TKey, vars?: Vars) => string;
  /** Translate a known piece of school data (subject, period, holiday...). Unknown text is returned unchanged. */
  d: (text: string) => string;
}
export const LangCtx = React.createContext<LangValue | null>(null);

export const interpolate = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

/** For shared components: `tr("key", "English text {var}", vars)`. English is used when there is no parent provider. */
export function useTr() {
  const c = React.useContext(LangCtx);
  return React.useCallback((key: TKey, en: string, vars?: Vars) => (c ? c.t(key, vars) : interpolate(en, vars)), [c]);
}
/** Shared components: translate school data such as subject names. Identity outside the parent portal. */
export function useData() {
  return React.useContext(LangCtx)?.d ?? ((s: string) => s);
}
export function useLang(): Lang {
  return React.useContext(LangCtx)?.lang ?? "en";
}
/** IST and calendar-date formatters bound to the current language. Numerals stay Western. */
export function useFmt() {
  const lang = useLang();
  return React.useMemo(() => ({
    lang,
    ist: (utc: string | Date, style?: Parameters<typeof formatIST>[1]) => formatIST(utc, style, lang),
    on: (dateOn: string, style?: Parameters<typeof formatDateOn>[1]) => formatDateOn(dateOn, style, lang),
  }), [lang]);
}
