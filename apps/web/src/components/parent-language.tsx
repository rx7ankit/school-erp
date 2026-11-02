"use client";
import { useLanguage, useT } from "@/lib/parent-i18n";
import { cn } from "@/lib/utils";

/** First open: a full-width card at the top asking which language to use. Choosing stores it and removes the card. */
export function LanguageChooser() {
  const { setLang } = useLanguage();
  const t = useT();
  return (
    <section aria-labelledby="lang-choose" className="mt-3 flex flex-col gap-4 rounded-[20px] bg-accent-subtle p-5 sm:p-6">
      <div>
        <h2 id="lang-choose" className="text-[19px] font-bold tracking-tight">{t("lang.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">English · हिन्दी</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" lang="en" onClick={() => setLang("en")} className="h-16 rounded-full bg-card text-xl font-bold hover:bg-card-hover">English</button>
        <button type="button" lang="hi" onClick={() => setLang("hi")} className="h-16 rounded-full bg-brand text-xl font-bold text-brand-foreground hover:bg-accent-hover">हिन्दी</button>
      </div>
    </section>
  );
}

/** Small EN | हि switch for the top bar. */
export function LanguageSwitch() {
  const { lang, setLang } = useLanguage();
  const t = useT();
  const opts = [["en", "EN", "English"], ["hi", "हि", "हिन्दी"]] as const;
  return (
    <div role="radiogroup" aria-label={t("lang.switch")} className="inline-flex gap-0.5 rounded-full bg-fill p-[3px]">
      {opts.map(([v, short, full]) => (
        <button key={v} type="button" role="radio" aria-checked={lang === v} aria-label={full} lang={v} onClick={() => setLang(v)}
          className={cn("grid h-8 min-w-9 place-items-center rounded-full px-2.5 text-[13px] font-bold text-muted-foreground", lang === v && "bg-solid text-on-solid")}>{short}</button>
      ))}
    </div>
  );
}
