"use client";

import { Heading } from "@/components/heading";
import { ButtonLink } from "@/components/ui/button";
import { DashboardMockup } from "@/components/mockups/dashboard";
import { useT } from "@/lib/i18n";

export function Hero() {
  const t = useT();
  return (
    <section id="top" aria-labelledby="hero-heading" className="px-4 pb-8 pt-12 sm:px-6 md:pt-20">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mx-auto max-w-[980px] text-center">
          <Heading as="h1" id="hero-heading" size="display" lead={t.hero.lead} dim={t.hero.dim} />
          <p className="mx-auto mt-6 max-w-[640px] text-[clamp(1.0625rem,2vw,1.375rem)] leading-[1.55] text-text-secondary">{t.hero.sub}</p>
          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="#contact" variant="accent" size="lg">
              {t.common.bookDemo}
            </ButtonLink>
            <ButtonLink href="#features" variant="solid" size="lg">
              {t.hero.secondary}
            </ButtonLink>
          </div>
        </div>

        <div className="mt-12 rounded-[28px] bg-card p-2.5 sm:p-5 md:mt-16 md:rounded-[36px] md:p-7">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
