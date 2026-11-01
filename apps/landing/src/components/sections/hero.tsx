import { Heading } from "@/components/heading";
import { ButtonLink } from "@/components/ui/button";
import { DashboardMockup } from "@/components/mockups/dashboard";

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-heading" className="px-4 pb-8 pt-12 sm:px-6 md:pt-20">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mx-auto max-w-[980px] text-center">
          <Heading
            as="h1"
            id="hero-heading"
            size="display"
            lead="Run your whole school."
            dim="From one calm place."
          />
          <p className="mx-auto mt-6 max-w-[640px] text-[clamp(1.0625rem,2vw,1.375rem)] leading-[1.5] text-text-secondary">
            Scool brings attendance, fees, results and parent messages together for schools in Rewa. On web, iPhone and Android.
          </p>
          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="#contact" variant="accent" size="lg">
              Book a demo
            </ButtonLink>
            <ButtonLink href="#features" variant="solid" size="lg">
              See how it works
            </ButtonLink>
          </div>
        </div>

        <div className="mt-12 rounded-[28px] bg-card p-2.5 sm:p-5 md:mt-16 md:rounded-[36px] md:p-7">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
