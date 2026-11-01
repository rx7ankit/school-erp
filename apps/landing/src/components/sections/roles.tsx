"use client";

import { Heading } from "@/components/heading";
import { Eyebrow, Section } from "@/components/section";
import { useT } from "@/lib/i18n";

export function Roles() {
  const t = useT().roles;
  return (
    <Section id="roles" labelledBy="roles-heading">
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <Heading id="roles-heading" lead={t.lead} dim={t.dim} className="max-w-3xl" />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {t.items.map((item) => (
          <li key={item.role} className="flex flex-col rounded-[24px] bg-card p-6">
            <h3 className="text-[22px] font-bold tracking-[-0.02em]">{item.role}</h3>
            <p className="mt-3 text-[15px] leading-[1.6] text-text-secondary">{item.sees}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
