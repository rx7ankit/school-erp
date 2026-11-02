import Link from "next/link";
import { InView } from "@/components/in-view";
import { LogoMark, MARK, WORDMARK } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { FOOTER, NAV_LINKS } from "@/lib/content";

/** The wordmark path holds one sub-path per letter (K r e v o), so each can animate on its own. */
const LETTERS = WORDMARK.split("M")
  .filter(Boolean)
  .map((d) => `M${d}`);

function ModuleRow() {
  return (
    <div className="fx-track flex w-max" aria-hidden="true">
      {[0, 1].map((copy) => (
        <ul key={copy} className="flex shrink-0 items-center gap-8 pr-8 md:gap-12 md:pr-12">
          {FOOTER.modules.map((m) => (
            <li key={m} className="flex items-center gap-8 text-[clamp(1.5rem,3vw,2.4rem)] font-bold tracking-[-0.03em] text-text/85 md:gap-12">
              {m}
              <LogoMark className="size-4 text-text-tertiary md:size-5" />
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
      <div className="relative overflow-hidden rounded-t-[32px] bg-card pt-12 sm:rounded-t-[44px] md:pt-16">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col items-start gap-5">
            <p className="max-w-[16ch] text-[clamp(1.6rem,3vw,2.2rem)] font-bold leading-[1.1] tracking-[-0.03em]">{FOOTER.blurb}</p>
            <ButtonLink href="#contact" variant="solid" size="lg">
              {FOOTER.cta}
            </ButtonLink>
          </div>
          <nav aria-label="Footer">
            <ul className="-mx-3 flex flex-wrap gap-x-1 gap-y-0 text-[15px] font-medium md:justify-end">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="flex min-h-11 items-center rounded-full px-3 text-text-secondary hover:text-text focus-visible:outline-2">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mx-auto mt-10 flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 text-[13px] text-text-tertiary sm:px-6">
          <p>{FOOTER.copy}</p>
          <a href={`mailto:${FOOTER.email}`} className="flex min-h-11 items-center text-text-secondary hover:text-text focus-visible:outline-2">
            {FOOTER.email}
          </a>
        </div>

        <div className="relative mt-4 overflow-hidden py-5 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] md:py-7">
          <ModuleRow />
        </div>
        <div className="relative mx-auto h-px w-full max-w-[1200px] overflow-hidden bg-separator">
          <span className="fx-sweep absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-solid to-transparent" />
        </div>

        <InView className="mx-auto mt-6 w-full max-w-[1200px] px-2 sm:px-6 md:mt-10">
          <svg
            viewBox="120 80 859 262"
            fill="currentColor"
            role="img"
            aria-label="Krevo"
            className="block h-auto w-full text-text [mask-image:linear-gradient(to_bottom,#000_60%,transparent_99%)]"
          >
            <g className="fx-letter" style={{ "--i": 0 } as React.CSSProperties}>
              <g className="fx-mark">{MARK}</g>
            </g>
            {LETTERS.map((d, i) => (
              <g key={i} className="fx-letter" style={{ "--i": i + 1 } as React.CSSProperties}>
                <path className="fx-bob" d={d} />
              </g>
            ))}
          </svg>
        </InView>
      </div>
    </footer>
  );
}
