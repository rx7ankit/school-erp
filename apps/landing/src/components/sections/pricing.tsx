import { Heading } from "@/components/heading";
import { PricingCard } from "@/components/pricing-card";
import { Eyebrow, Section } from "@/components/section";

export function Pricing() {
  return (
    <Section id="pricing" labelledBy="pricing-heading">
      <Eyebrow>Pricing</Eyebrow>
      <Heading id="pricing-heading" lead="One price for the whole school." dim="Pay only for your students." className="max-w-3xl" />
      <div className="mt-10">
        <PricingCard />
      </div>
    </Section>
  );
}
