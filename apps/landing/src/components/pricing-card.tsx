"use client";

import { CheckIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PRICE_PER_STUDENT_RUPEES, formatRupees, monthlyBill } from "@/lib/pricing";
import { useT } from "@/lib/i18n";

const EXAMPLE_STUDENTS = 500;

export function PricingCard() {
  const t = useT().pricing;
  return (
    <div className="grid gap-10 rounded-[28px] bg-card p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:p-14">
      <div className="flex flex-col">
        <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{t.badge}</p>
        <div className="mt-5 flex flex-wrap items-baseline gap-x-3 font-bold tracking-[-0.04em]">
          <span className="text-[clamp(4.5rem,13vw,7.5rem)] leading-none">{formatRupees(PRICE_PER_STUDENT_RUPEES)}</span>
          <span className="dim text-[clamp(1.25rem,2.4vw,1.75rem)] leading-tight tracking-[-0.02em]">{t.per}</span>
        </div>
        <p className="mt-5 max-w-md text-[17px] leading-[1.6] text-text-secondary">{t.intro}</p>

        <div className="mt-8 rounded-[20px] bg-bg p-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{t.exampleTitle}</p>
          <p className="mt-2 text-[17px] font-bold tracking-[-0.01em]">
            {EXAMPLE_STUDENTS} {t.students} × {formatRupees(PRICE_PER_STUDENT_RUPEES)} = {formatRupees(monthlyBill(EXAMPLE_STUDENTS))} {t.aMonth}
          </p>
          <p className="mt-3 text-[14px] leading-[1.6] text-text-secondary">{t.billed}</p>
        </div>

        <div className="mt-8">
          <ButtonLinkDemo />
        </div>
      </div>

      <div>
        <h3 className="text-[20px] font-bold tracking-[-0.01em]">{t.includedTitle}</h3>
        <ul className="mt-5 flex flex-col gap-3.5">
          {t.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-[16px] leading-[1.45]">
              <CheckIcon className="mt-0.5 size-5 text-success" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ButtonLinkDemo() {
  const t = useT();
  return (
    <ButtonLink href="#contact" variant="accent" size="lg">
      {t.common.bookDemo}
    </ButtonLink>
  );
}
