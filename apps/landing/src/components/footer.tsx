import Link from "next/link";
import { InView } from "@/components/in-view";
import { MARK, WORDMARK } from "@/components/logo";
import { Reveal, WordReveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { FOOTER, FOOTER_CTA, NAV_LINKS } from "@/lib/content";

/** The wordmark path holds sub-paths for K, r, e, v, o. The counters of "e" and "o" are their own sub-paths, so they
 * are merged back into their letter; drawn alone they would fill the holes in. */
const PARTS = WORDMARK.split("M")
  .filter(Boolean)
  .map((d) => `M${d}`);
const LETTERS = [PARTS[0], PARTS[1], PARTS[2] + PARTS[3], PARTS[4], PARTS[5] + PARTS[6]];

export function Footer() {
  return (
    <footer className="px-2 pt-2 sm:px-3">
      <div className="relative isolate overflow-hidden rounded-t-[32px] bg-bg pt-16 sm:rounded-t-[44px] md:pt-24">
        <div aria-hidden="true" className="foot-dots pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid w-full max-w-[1200px] items-end gap-8 px-5 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
          <WordReveal as="h2" title={FOOTER_CTA.title} dim={FOOTER_CTA.dim} className="text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[1.04] tracking-[-0.045em]" />
          <Reveal y={16} delay={250} className="flex flex-col items-start gap-6">
            <p className="max-w-[36ch] text-[17px] leading-snug text-text-secondary">{FOOTER_CTA.line}</p>
            <ButtonLink href="#contact" variant="solid" size="lg">
              {FOOTER.cta}
            </ButtonLink>
          </Reveal>
        </div>

        <div className="mx-auto mt-16 w-full max-w-[1200px] px-5 sm:px-8 md:mt-24">
          <div className="h-px w-full bg-[#ECECF0]" />
          <div className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <svg viewBox="136 80 882 285" fill="currentColor" role="img" aria-label="Krevo" className="h-7 w-auto self-start text-text">
                <g transform="translate(262 222.5) scale(0.88) translate(-262 -222.5)">{MARK}</g>
                <path d={WORDMARK} transform="translate(453.7 223.6) scale(1.12) translate(-474.7 -223.6)" />
              </svg>
              <p className="text-[14px] text-text-tertiary">
                {FOOTER.blurb} {FOOTER.blurbDim}
              </p>
            </div>
            <nav aria-label="Footer">
              <ul className="-mx-3 flex flex-wrap gap-x-1 text-[15px] font-medium">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="flex min-h-11 items-center rounded-full px-3 text-text-secondary hover:text-text focus-visible:outline-2">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex flex-col gap-1 text-[13px] text-text-tertiary md:items-end">
              <a href={`mailto:${FOOTER.email}`} className="flex min-h-11 items-center text-[15px] font-medium text-text-secondary hover:text-text focus-visible:outline-2">
                {FOOTER.email}
              </a>
              <Link href="/privacy" className="-mt-2 flex min-h-11 items-center text-[14px] text-text-secondary hover:text-text focus-visible:outline-2">
                Privacy policy
              </Link>
              <p className="-mt-3">{FOOTER.copy}</p>
            </div>
          </div>
        </div>

        <InView className="mx-auto mt-6 w-full max-w-[1100px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:px-6 md:mt-10 md:pb-14">
          <svg viewBox="126 70 897 305" role="img" aria-label="Krevo" className="block h-auto w-full overflow-visible">
            <defs>
              <linearGradient id="foot-grey" gradientUnits="userSpaceOnUse" x1="0" y1="80" x2="0" y2="365">
                <stop offset="0" stopColor="#D7D7DC" />
                <stop offset="0.7" stopColor="#ECEBEC" />
                <stop offset="1" stopColor="#F6F1EC" />
              </linearGradient>
            </defs>
            <g fill="url(#foot-grey)">
              <g transform="translate(262 222.5) scale(0.88) translate(-262 -222.5)">
                <g className="fx-letter" style={{ "--i": 0 } as React.CSSProperties}>
                  <g className="fx-mark">{MARK}</g>
                </g>
              </g>
              <g transform="translate(453.7 223.6) scale(1.12) translate(-474.7 -223.6)">
                {LETTERS.map((d, i) => (
                  <g key={i} className="fx-letter" style={{ "--i": i + 1 } as React.CSSProperties}>
                    <path className="fx-bob" fillRule="evenodd" d={d} />
                  </g>
                ))}
              </g>
            </g>
          </svg>
        </InView>
      </div>
    </footer>
  );
}
