"use client";

import { useEffect } from "react";
import { HTML_LANG, useLang, useT } from "@/lib/i18n";

/** Keeps <html lang>, the page title and the meta description in step with the chosen language. */
export function LangEffects() {
  const lang = useLang();
  const t = useT();
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
    const apply = () => {
      if (document.title !== t.meta.title) document.title = t.meta.title;
      const meta = document.querySelector('meta[name="description"]');
      if (meta && meta.getAttribute("content") !== t.meta.description) meta.setAttribute("content", t.meta.description);
    };
    apply();
    // Next's own metadata may re-render the head after hydration; keep our text on top.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["content"] });
    return () => observer.disconnect();
  }, [lang, t]);
  return null;
}
