"use client";
import * as React from "react";
import { common } from "./dict/common";
import { nav } from "./dict/nav";
import { staffA } from "./dict/staffA";
import { staffB } from "./dict/staffB";
import { parent } from "./dict/parent";
import { owner } from "./dict/owner";
import { setLocale } from "../time";

export type Lang = "en" | "hi";
const DICTS = [common, nav, staffA, staffB, parent, owner] as const;
type Keys<D> = D extends { en: infer E } ? keyof E & string : never;
export type TKey = Keys<(typeof DICTS)[number]>;

const MERGED: Record<Lang, Record<string, string>> = {
  en: Object.assign({}, ...DICTS.map((d) => d.en)),
  hi: Object.assign({}, ...DICTS.map((d) => d.hi)),
};

const KEY = "scool.lang";
const EVT = "scool:lang";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const read = (): Lang => { try { return localStorage.getItem(KEY) === "hi" ? "hi" : "en"; } catch { return "en"; } };

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (key: TKey, params?: Record<string, string | number>) => string; }
const LangCtx = React.createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = React.useSyncExternalStore<Lang>(subscribe, read, () => "en");
  setLocale(lang === "hi" ? "hi-IN" : "en-IN");
  React.useEffect(() => { document.documentElement.lang = lang === "hi" ? "hi-IN" : "en-IN"; }, [lang]);
  const value = React.useMemo<Ctx>(() => ({
    lang,
    setLang: (l) => { try { localStorage.setItem(KEY, l); } catch {} window.dispatchEvent(new Event(EVT)); },
    t: (key, params) => {
      const raw = MERGED[lang][key] ?? MERGED.en[key] ?? key;
      return params ? raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : raw;
    },
  }), [lang]);
  // Re-mount the tree on change so every date and number re-renders in the new language.
  return <LangCtx.Provider value={value}><React.Fragment key={lang}>{children}</React.Fragment></LangCtx.Provider>;
}

export function useT() {
  const c = React.useContext(LangCtx);
  if (!c) throw new Error("useT must be used inside LanguageProvider");
  return c;
}
