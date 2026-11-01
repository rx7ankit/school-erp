"use client";

import { ContactForm } from "@/components/contact-form";
import { Heading } from "@/components/heading";
import { Eyebrow, Section } from "@/components/section";
import { useT } from "@/lib/i18n";

export function Contact() {
  const t = useT().contact;
  return (
    <Section id="contact" labelledBy="contact-heading">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <Heading id="contact-heading" lead={t.lead} dim={t.dim} />
          <p className="mt-5 max-w-md text-[17px] leading-[1.6] text-text-secondary">{t.body}</p>
        </div>
        <ContactForm />
      </div>
    </Section>
  );
}
