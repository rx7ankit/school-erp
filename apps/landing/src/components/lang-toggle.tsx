"use client";

import { setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const OPTIONS: ReadonlyArray<{ lang: Lang; label: string; htmlLang: string }> = [
  { lang: "en", label: "EN", htmlLang: "en" },
  { lang: "hi", label: "हिन्दी", htmlLang: "hi" },
];

/** EN | हिन्दी switch. Saved in localStorage as scool.lang. */
export function LangToggle() {
  const current = useLang();
  const t = useT();
  return (
    <div role="group" aria-label={t.nav.language} className="flex h-9 items-center rounded-full bg-fill p-0.5">
      {OPTIONS.map((option) => {
        const active = option.lang === current;
        return (
          <button
            key={option.lang}
            type="button"
            lang={option.htmlLang}
            aria-pressed={active}
            onClick={() => setLang(option.lang)}
            className={cn(
              "h-8 rounded-full px-2 text-[13px] sm:px-2.5 font-semibold focus-visible:outline-2",
              active ? "bg-solid text-on-solid" : "text-text-secondary hover:text-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
