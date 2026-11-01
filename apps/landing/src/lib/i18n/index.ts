"use client";

import { useSyncExternalStore } from "react";
import { en, type Dict } from "./en";
import { hi } from "./hi";

export type Lang = "en" | "hi";
export type { Dict };

const KEY = "scool.lang";
const EVENT = "scool-lang-change";
const DICTS: Record<Lang, Dict> = { en, hi };

export const HTML_LANG: Record<Lang, string> = { en: "en-IN", hi: "hi" };

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "hi" ? "hi" : "en";
  } catch {
    return document.documentElement.lang === "hi" ? "hi" : "en";
  }
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private mode: language still changes for this visit */
  }
  document.documentElement.lang = HTML_LANG[lang];
  window.dispatchEvent(new Event(EVENT));
}

/** Current language. English on the server and during hydration, then the saved choice. */
export function useLang(): Lang {
  return useSyncExternalStore<Lang>(subscribe, getLang, () => "en");
}

/** The typed dictionary for the current language. */
export function useT(): Dict {
  return DICTS[useLang()];
}
