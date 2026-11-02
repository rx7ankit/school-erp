"use client";

import { useState } from "react";
import Link from "next/link";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { NAV_LINKS } from "@/lib/content";

/** Menu disclosure for screens narrower than lg. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-full text-text hover:bg-card focus-visible:outline-2"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      <nav id="mobile-menu" aria-label="Sections" hidden={!open} className="absolute inset-x-0 top-16 border-b border-separator/60 bg-bg px-4 pb-4 pt-1">
        <ul className="flex flex-col rounded-[20px] bg-card p-2">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-[14px] px-4 text-[17px] font-semibold text-text hover:bg-card-hover focus-visible:outline-2">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
