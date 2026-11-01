"use client";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

/** EN / हिन्दी switch. Applies instantly everywhere. */
export function LanguageToggle() {
  const { lang, setLang, t } = useT();
  return (
    <Button variant="secondary" size="sm" aria-label={t("common.language")} onClick={() => setLang(lang === "en" ? "hi" : "en")}>
      <Languages />{lang === "en" ? t("lang.hi") : t("lang.en")}
    </Button>
  );
}
