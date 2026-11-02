import { CheckIcon } from "@/components/icons";
import { InView } from "@/components/in-view";
import { Section } from "@/components/section";
import { ButtonLink } from "@/components/ui/button";
import { PRICING } from "@/lib/content";

export function Pricing() {
  return (
    <Section id="pricing" title={PRICING.title} dim={PRICING.dim} line={PRICING.line}>
      <InView reveal className="mx-auto grid max-w-[980px] gap-8 rounded-[32px] bg-card p-6 sm:p-10 md:grid-cols-[1fr_1fr] md:items-center md:gap-12 md:p-14">
        <div>
          <div className="text-[clamp(5.5rem,18vw,9rem)] font-bold leading-[0.9] tracking-[-0.05em]">{PRICING.amount}</div>
          <p className="mt-3 text-[20px] font-semibold text-text-secondary">{PRICING.per}</p>
          <p className="mt-5 inline-flex rounded-full bg-bg px-4 py-2 text-[14px] font-semibold text-text-secondary">
            {PRICING.example.students} <span className="mx-2 text-text-tertiary">=</span> <span className="text-text">{PRICING.example.total}</span>
          </p>
          <ButtonLink href="#contact" variant="accent" size="lg" className="mt-8 w-full sm:w-auto">
            {PRICING.cta}
          </ButtonLink>
        </div>
        <ul className="flex flex-col gap-3.5">
          {PRICING.bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 text-[18px] font-semibold">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-solid text-on-solid">
                <CheckIcon className="size-4" />
              </span>
              {b}
            </li>
          ))}
        </ul>
      </InView>
    </Section>
  );
}
