"use client";

import { Faq } from "@/components/faq";
import { Heading } from "@/components/heading";
import { Eyebrow, Section } from "@/components/section";
import { useT } from "@/lib/i18n";

export function FaqSection() {
  const t = useT().faq;
  return (
    <Section id="faq" labelledBy="faq-heading">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <Heading id="faq-heading" lead={t.lead} dim={t.dim} />
        <div className="mt-10">
          <Faq items={t.items} />
        </div>
      </div>
    </Section>
  );
}
