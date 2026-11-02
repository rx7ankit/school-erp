import Link from "next/link";
import { InView } from "@/components/in-view";
import { LogoMark, MARK, WORDMARK } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { FOOTER, NAV_LINKS } from "@/lib/content";

/** The wordmark path holds sub-paths for K, r, e, v, o. The counters of "e" and "o" are their own sub-paths, so they
 * are merged back into their letter; drawn alone they would fill the holes in. */
const PARTS = WORDMARK.split("M")
  .filter(Boolean)
  .map((d) => `M${d}`);
const LETTERS = [PARTS[0], PARTS[1], PARTS[2] + PARTS[3], PARTS[4], PARTS[5] + PARTS[6]];

function ModuleRow() {
  return (
    <div className="fx-track flex w-max" aria-hidden="true">
      {[0, 1].map((copy) => (
        <ul key={copy} className="flex shrink-0 items-center gap-8 pr-8 md:gap-12 md:pr-12">
          {FOOTER.modules.map((m) => (
            <li key={m} className="flex items-center gap-8 text-[clamp(1.5rem,3vw,2.4rem)] font-bold tracking-[-0.03em] text-[#B4B4BA] md:gap-12">
              {m}
              <LogoMark className="size-4 text-[#D2D2D7] md:size-5" />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="px-2 pt-6 sm:px-3">
      <div className="relative isolate overflow-hidden rounded-t-[32px] bg-card pt-12 sm:rounded-t-[44px] md:pt-16">
        <div aria-hidden="true" className="foot-dots pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col items-start gap-5">
            <p className="max-w-[18ch] text-[clamp(1.6rem,3vw,2.2rem)] font-bold leading-[1.1] tracking-[-0.03em] text-text">{FOOTER.blurb} <span className="dim">{FOOTER.blurbDim}</span></p>
            <ButtonLink href="#contact" variant="solid" size="lg">
              {FOOTER.cta}
            </ButtonLink>
          </div>
          <nav aria-label="Footer">
            <ul className="-mx-3 flex flex-wrap gap-x-1 gap-y-0 text-[15px] font-medium md:justify-end">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="flex min-h-11 items-center rounded-full px-3 text-[#8E8E93] hover:text-text-secondary focus-visible:outline-2">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mx-auto mt-10 flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 text-[13px] text-[#A1A1A6] sm:px-6">
          <p>{FOOTER.copy}</p>
          <a href={`mailto:${FOOTER.email}`} className="flex min-h-11 items-center text-[#8E8E93] hover:text-text-secondary focus-visible:outline-2">
            {FOOTER.email}
          </a>
        </div>

        <div className="relative mt-4 overflow-hidden py-5 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] md:py-7">
          <ModuleRow />
        </div>
        <div className="relative mx-auto h-px w-full max-w-[1200px] overflow-hidden bg-separator">
          <span className="fx-sweep absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-solid to-transparent" />
        </div>

        <InView className="mx-auto mt-8 w-full max-w-[860px] px-5 pb-10 sm:px-6 md:mt-12 md:pb-16">
          <svg viewBox="110 70 879 305" role="img" aria-label="Krevo" className="block h-auto w-full overflow-visible">
            <defs>
              <linearGradient id="foot-grey" gradientUnits="userSpaceOnUse" x1="0" y1="80" x2="0" y2="365">
                <stop offset="0" stopColor="#CDCDD2" />
                <stop offset="1" stopColor="#B2B2B8" />
              </linearGradient>
            </defs>
            <g fill="url(#foot-grey)">
              <g className="fx-letter" style={{ "--i": 0 } as React.CSSProperties}>
                <g className="fx-mark">{MARK}</g>
              </g>
              {LETTERS.map((d, i) => (
                <g key={i} className="fx-letter" style={{ "--i": i + 1 } as React.CSSProperties}>
                  <path className="fx-bob" fillRule="evenodd" d={d} />
                </g>
              ))}
            </g>
          </svg>
        </InView>
      </div>
    </footer>
  );
}
