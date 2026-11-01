"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { NAV_LINKS } from "@/lib/nav";
import { useT } from "@/lib/i18n";

export function Footer() {
  const t = useT();
  const linkClass = "text-text-secondary hover:text-text focus-visible:outline-2";
  return (
    <footer className="px-4 pb-10 pt-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 border-t border-separator pt-10 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Logo className="h-7" />
          <p className="mt-4 text-[15px] leading-[1.6] text-text-secondary">{t.footer.blurb}</p>
        </div>
        <nav aria-label={t.nav.footer}>
          <ul className="flex flex-wrap gap-x-8 gap-y-3 text-[15px] font-medium">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {t.nav[link.key]}
                </Link>
              </li>
            ))}
            <li>
              <Link href="#contact" className={linkClass}>
                {t.common.bookDemo}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-10 w-full max-w-[1200px] text-[13px] text-text-tertiary">{t.footer.copy}</p>
    </footer>
  );
}
