import { Faq } from "@/components/faq";
import { SectionHead } from "@/components/section";
import { FAQS, FAQ_HEAD } from "@/lib/content";

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-h" className="px-4 py-14 sm:px-6 md:py-20">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:pt-2">
          <SectionHead id="faq" title={FAQ_HEAD.title} line={FAQ_HEAD.line} left />
        </div>
        <Faq items={FAQS} />
      </div>
    </section>
  );
}
