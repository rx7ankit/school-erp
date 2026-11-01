"use client";

import Link from "next/link";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { ButtonLink } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/nav";
import { useT } from "@/lib/i18n";

export function Header() {
  const t = useT();
  return (
    <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-1 px-3 sm:gap-2 sm:px-6">
        <Link href="#top" aria-label={t.nav.home} className="shrink-0 rounded-full focus-visible:outline-2">
          <Logo className="hidden h-6 sm:block" />
          <LogoMark className="size-8 sm:hidden" />
        </Link>
        <nav aria-label={t.nav.main} className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-[14px] font-medium text-text-secondary hover:text-text focus-visible:outline-2"
            >
              {t.nav[link.key]}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <LangToggle />
          <ThemeToggle />
          <ButtonLink href="#contact" variant="solid" className="hidden h-10 px-4 text-[14px] sm:inline-flex">
            {t.common.bookDemo}
          </ButtonLink>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
