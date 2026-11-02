import { CheckIcon } from "@/components/icons";
import { CountUp, Parallax, Pop, Reveal, ScrollWords } from "@/components/motion";
import { PRICING, PRICING_STORY } from "@/lib/content";
import { Heading } from "./heading";

const LIFT = "[filter:drop-shadow(0_14px_30px_rgba(20,20,30,0.1))]";

/** Pricing in the reference's testimonial layout: stacked cards on the left, a big scroll-lit paragraph on the right. */
export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-h" className="relative overflow-hidden bg-bg px-4 pb-[100px] pt-[96px] sm:px-6 md:pb-[150px] md:pt-[140px]">
      <div className="mx-auto w-full max-w-[1200px]">
        <Heading id="pricing" title={PRICING.title} dim={PRICING.dim} line={PRICING.line} />
        <div className="mt-14 grid items-center gap-14 md:mt-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div className="relative mx-auto w-full max-w-[460px] lg:mx-0">
            <Reveal blur={0} y={40} duration={1100}>
              <div className={LIFT}>
                <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(180deg,#2A2A2D,#1C1C1E)] p-8 text-[#fff] sm:p-10">
                  <span aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)]" />
                  <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.13),transparent)]" />
                  <span className="inline-flex h-8 items-center rounded-full bg-[#fff]/10 px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-[#fff]/70">{PRICING_STORY.label}</span>
                  <div className="mt-8 text-[clamp(5.5rem,16vw,8rem)] font-bold leading-[0.9] tracking-[-0.06em]">
                    <CountUp to={10} prefix="₹" duration={1600} />
                  </div>
                  <p className="mt-4 text-[19px] font-medium text-[#fff]/60">{PRICING_STORY.per}</p>
                </div>
              </div>
            </Reveal>
            <Parallax speed={-0.05} className="relative z-10 -mt-10 ml-8 sm:ml-16">
              <Pop delay={500} stagger={0}>
                <div className={LIFT}>
                  <div className="rounded-[28px] border border-[#ECECF0] bg-[linear-gradient(180deg,#FFFFFF,#F8F8FA)] p-6">
                    <p className="text-[14px] font-semibold text-text-secondary">{PRICING.example.students}</p>
                    <p className="mt-1.5 text-[clamp(1.9rem,4vw,2.4rem)] font-bold leading-none tracking-[-0.04em]">
                      <CountUp to={4000} prefix="₹" delay={700} duration={1500} />
                      <span className="ml-2 text-[16px] font-semibold tracking-normal text-text-tertiary">a month</span>
                    </p>
                  </div>
                </div>
              </Pop>
            </Parallax>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-16 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,226,208,0.45),rgba(255,226,208,0))] md:-right-6" />
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-0 select-none text-[clamp(14rem,30vw,24rem)] font-bold leading-none tracking-[-0.05em] text-[#F0EEEC] md:-bottom-28">
              ₹
            </span>
            <div className="relative text-[clamp(1.35rem,2.2vw,1.75rem)] font-medium leading-[1.4] tracking-[-0.02em] text-text">
              <ScrollWords as="p" text={PRICING_STORY.lead} className="font-bold" />
              <ScrollWords as="p" text={PRICING_STORY.rest} className="mt-3" />
              <ul className="mt-10 flex flex-wrap gap-2.5">
                {PRICING.bullets.map((b, i) => (
                  <li key={b}>
                    <Pop i={i} stagger={80} delay={200}>
                      <span className="inline-flex h-10 items-center gap-2 rounded-full bg-[#F3F3F6] px-4 text-[14px] font-semibold tracking-normal text-text">
                        <CheckIcon className="size-3.5 text-text-secondary" />
                        {b}
                      </span>
                    </Pop>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
