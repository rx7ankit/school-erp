"use client";

import { useState } from "react";
import Link from "next/link";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { NAV_LINKS } from "@/lib/nav";
import { useT } from "@/lib/i18n";

/** Menu disclosure for screens narrower than lg. */
export function MobileNav() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full text-text hover:bg-card sm:size-11 focus-visible:outline-2"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      <nav id="mobile-menu" aria-label={t.nav.sections} hidden={!open} className="absolute inset-x-0 top-16 bg-bg px-4 pb-4 pt-1">
        <ul className="flex flex-col rounded-[20px] bg-card p-2">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-[14px] px-4 py-3 text-[17px] font-semibold text-text hover:bg-card-hover focus-visible:outline-2"
              >
                {t.nav[link.key]}
              </Link>
            </li>
          ))}
          <li className="sm:hidden">
            <Link
              href="#contact"
              onClick={() => setOpen(false)}
              className="block rounded-[14px] px-4 py-3 text-[17px] font-semibold text-accent hover:bg-card-hover focus-visible:outline-2"
            >
              {t.common.bookDemo}
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
