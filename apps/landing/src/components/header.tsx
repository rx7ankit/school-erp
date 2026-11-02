"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";
import { ButtonLink } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/content";

/**
 * The floating nav pill: fixed, centred, max 1040px, frosted (70% white, backdrop blur, hairline top highlight).
 * Its parts are separate layers so the intro can grow the glass (`.nav-bg`, clip-path) while the content row keeps
 * its final layout (the splash logo flies to the real `[data-site-logo]`). Past 40px of scroll it frosts a bit more.
 */
export function Header() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      el.dataset.scrolled = window.scrollY > 40 ? "true" : "false";
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header ref={ref} data-scrolled="false" className="nav pointer-events-none fixed inset-x-0 top-4 z-50 px-3 sm:px-4">
      <div className="nav-wrap pointer-events-auto relative mx-auto w-full max-w-[1040px]">
        <i aria-hidden="true" className="nav-halo" />
        <i aria-hidden="true" className="nav-bg" />
        <div className="relative flex h-16 items-center gap-2 pl-5 pr-2.5">
          <Link href="#top" data-site-logo aria-label="Krevo, back to top" className="nav-logo relative z-10 -ml-2 flex h-11 shrink-0 items-center rounded-full px-2 text-text focus-visible:outline-2">
            <Logo className="h-7" />
          </Link>
          <nav aria-label="Main" className="mx-auto hidden items-center gap-0.5 lg:flex">
            {NAV_LINKS.map((link, i) => (
              <Link key={link.href} href={link.href} style={{ "--i": i } as React.CSSProperties} className="nav-link rounded-full px-4 py-2.5 text-[15px] font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-2">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <ButtonLink href="#contact" variant="solid" className="nav-cta relative z-10 h-11 px-5 text-[14px] sm:text-[15px]">
              Book a demo
            </ButtonLink>
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
