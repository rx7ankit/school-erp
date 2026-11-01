"use client";

import { Eyebrow } from "@/components/section";
import { Heading } from "@/components/heading";
import { useT } from "@/lib/i18n";

export function Benefits() {
  const t = useT().benefits;
  return (
    <section id="benefits" aria-labelledby="benefits-heading" className="px-4 py-12 sm:px-6 md:py-16">
      <div className="mx-auto w-full max-w-[1200px]">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <Heading id="benefits-heading" lead={t.lead} dim={t.dim} className="max-w-3xl" />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {t.items.map((benefit) => (
            <li key={benefit.title} className="rounded-[24px] bg-card p-7 md:p-8">
              <h3 className="text-[22px] font-bold leading-tight tracking-[-0.02em]">{benefit.title}</h3>
              <p className="mt-3 text-[16px] leading-[1.6] text-text-secondary">{benefit.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
