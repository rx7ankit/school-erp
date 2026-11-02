import { CalendarCheckIcon, CheckIcon, SchoolIcon } from "@/components/icons";
import { ContactForm } from "@/components/contact-form";
import { InView } from "@/components/in-view";
import { SectionHead } from "@/components/section";
import { CONTACT } from "@/lib/content";

const STEPS = [
  [SchoolIcon, "Tell us about your school"],
  [CalendarCheckIcon, "See a 20-minute demo"],
  [CheckIcon, "Start with your own data"],
] as const;

export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-h" className="px-4 py-14 sm:px-6 md:py-20">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <SectionHead id="contact" title={CONTACT.title} line={CONTACT.line} left />
          <ul className="space-y-3">
            {STEPS.map(([Icon, label], i) => (
              <InView as="li" reveal delay={i * 100} key={label} className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-subtle text-accent">
                  <Icon className="size-5" />
                </span>
                <span className="text-[17px] font-semibold">{label}</span>
              </InView>
            ))}
          </ul>
        </div>
        <InView reveal delay={120}>
          <ContactForm />
        </InView>
      </div>
    </section>
  );
}
