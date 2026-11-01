import { ContactForm } from "@/components/contact-form";
import { Heading } from "@/components/heading";
import { Eyebrow, Section } from "@/components/section";

export function Contact() {
  return (
    <Section id="contact" labelledBy="contact-heading">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <Eyebrow>Book a demo</Eyebrow>
          <Heading id="contact-heading" lead="See Scool with your own school." dim="Tell us a little about it." />
          <p className="mt-5 max-w-md text-[17px] leading-[1.6] text-text-secondary">
            Share a few details and we will get in touch to arrange a short demo. We aim to reply within one working day.
          </p>
        </div>
        <ContactForm />
      </div>
    </Section>
  );
}
