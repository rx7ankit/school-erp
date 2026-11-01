"use client";

import { Heading } from "@/components/heading";
import { Section, Eyebrow } from "@/components/section";
import { ParentHomePhone, ParentResultsPhone } from "@/components/mockups/parent-phone";
import { useT } from "@/lib/i18n";

export function ParentApp() {
  const t = useT().parents;
  return (
    <Section id="parents" labelledBy="parents-heading" panel>
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <Heading id="parents-heading" lead={t.lead} dim={t.dim} />
        <p className="mx-auto mt-5 max-w-2xl text-[18px] leading-[1.6] text-text-secondary">{t.body}</p>
      </div>

      <div className="mt-12 flex flex-col items-center justify-center gap-6 md:flex-row md:items-start md:gap-10">
        <ParentHomePhone />
        <ParentResultsPhone className="md:mt-12" />
      </div>

      <ul className="mx-auto mt-12 grid max-w-4xl gap-4 text-left md:grid-cols-3">
        {t.cards.map((card) => (
          <li key={card.title} className="rounded-[20px] bg-bg p-6">
            <h3 className="text-[18px] font-bold tracking-[-0.01em]">{card.title}</h3>
            <p className="mt-2 text-[15px] leading-[1.55] text-text-secondary">{card.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
