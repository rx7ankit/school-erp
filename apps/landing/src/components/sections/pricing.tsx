"use client";

import { Heading } from "@/components/heading";
import { PricingCard } from "@/components/pricing-card";
import { Eyebrow, Section } from "@/components/section";
import { useT } from "@/lib/i18n";

export function Pricing() {
  const t = useT().pricing;
  return (
    <Section id="pricing" labelledBy="pricing-heading">
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <Heading id="pricing-heading" lead={t.lead} dim={t.dim} className="max-w-3xl" />
      <div className="mt-10">
        <PricingCard />
      </div>
    </Section>
  );
}
