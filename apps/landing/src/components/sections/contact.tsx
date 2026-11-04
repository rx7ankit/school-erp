import { CalendarCheckIcon, CheckIcon, SchoolIcon } from "@/components/icons";
import { ContactForm } from "@/components/contact-form";
import { Faq } from "@/components/faq";
import { DrawLine, Pop, Reveal } from "@/components/motion";
import { CONTACT, CONTACT_PARA, CONTACT_STEPS, FAQS, FAQ_HEAD } from "@/lib/content";
import { Heading } from "./heading";

const STEP_ICONS = [SchoolIcon, CalendarCheckIcon, CheckIcon] as const;

export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-h" className="bg-[#F3F3F6] px-4 pb-[72px] pt-[72px] sm:px-6 md:pb-[150px] md:pt-[140px]">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="grid items-end gap-6 md:grid-cols-2 md:gap-16">
          <Heading id="contact" title={CONTACT.title} dim={CONTACT.dim} left />
          <Reveal as="p" delay={300} y={16} className="max-w-[40ch] text-[clamp(1.05rem,1.6vw,1.25rem)] leading-snug text-text-secondary md:justify-self-end">
            {CONTACT_PARA}
          </Reveal>
        </div>
        <div className="mt-10 grid gap-8 lg:mt-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <ol className="relative">
              <DrawLine d="M24 56 V112 M24 176 V232" viewBox="0 0 48 300" preserveAspectRatio="none" stroke="#C9CBD3" duration={1400} className="absolute left-0 top-0 hidden h-[300px] w-12 sm:block" />
              {CONTACT_STEPS.map((label, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <li key={label} className="flex items-start gap-4 pb-5 last:pb-0 sm:h-[120px] sm:gap-5 sm:pb-0 sm:last:h-auto">
                    <Pop i={i} stagger={160}>
                      <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-bg text-text [filter:drop-shadow(0_6px_14px_rgba(20,20,30,0.08))]">
                        <Icon className="size-5" />
                      </span>
                    </Pop>
                    <Reveal i={i} stagger={160} delay={100} y={14} className="pt-2.5">
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-tertiary">Step {i + 1}</p>
                      <p className="mt-1 text-[18px] font-semibold tracking-[-0.015em]">{label}</p>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
          <Reveal blur={0} y={40} duration={1100}>
            <ContactForm />
          </Reveal>
        </div>
        <Reveal className="mt-14 md:mt-20">
          <h3 className="mb-4 px-1 text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.03em]">{FAQ_HEAD}</h3>
          <Faq items={FAQS} compact />
        </Reveal>
      </div>
    </section>
  );
}
