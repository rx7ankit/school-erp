import { SchoolScene } from "@/components/art/scenes";
import { CalendarCheckIcon, CheckIcon, SchoolIcon } from "@/components/icons";
import { ContactForm } from "@/components/contact-form";
import { InView } from "@/components/in-view";
import { Faq } from "@/components/faq";
import { SectionHeading } from "@/components/section-heading";
import { CONTACT, CONTACT_STEPS, FAQS, FAQ_HEAD } from "@/lib/content";

const STEP_ICONS = [SchoolIcon, CalendarCheckIcon, CheckIcon] as const;

export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-h" className="px-4 py-14 sm:px-6 md:py-20">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <SectionHeading id="contact" title={CONTACT.title} dim={CONTACT.dim} line={CONTACT.line} left />
          <ul className="space-y-3">
            {CONTACT_STEPS.map((label, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <InView as="li" reveal delay={i * 100} key={label} className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-fill text-text">
                  <Icon className="size-5" />
                </span>
                <span className="text-[17px] font-semibold">{label}</span>
              </InView>
            );
          })}
          </ul>
          <InView reveal delay={300} className="mt-10">
            <SchoolScene />
          </InView>
        </div>
        <InView reveal delay={120}>
          <ContactForm />
          <div className="mt-8">
            <h3 className="mb-3 px-1 text-[18px] font-bold tracking-[-0.01em]">{FAQ_HEAD}</h3>
            <Faq items={FAQS} compact />
          </div>
        </InView>
      </div>
    </section>
  );
}
