"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { PresentButton } from "@/components/present/present-button";
import { ButtonLink } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/content";

const BACKGROUND = "main, footer";

function lockScroll(on: boolean) {
  document.documentElement.style.overflow = on ? "hidden" : "";
}

/**
 * Menu for screens narrower than lg. The header grows into a full-screen panel (clip-path), the two hamburger
 * lines rotate into an X, and the rows stagger in. Locks page scroll and inerts the page while open.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus = false) => {
    lockScroll(false); // before navigation so an anchor jump is not swallowed by the lock
    setOpen(false);
    if (restoreFocus) toggle.current?.focus();
  }, []);

  useEffect(() => {
    const bg = document.querySelectorAll<HTMLElement>(BACKGROUND);
    bg.forEach((el) => el.toggleAttribute("inert", open));
    if (!open) return;
    lockScroll(true);
    panel.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && close();
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      lockScroll(false);
      bg.forEach((el) => el.removeAttribute("inert"));
    };
  }, [open, close]);

  return (
    <div className="lg:hidden" data-open={open}>
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => (open ? close() : setOpen(true))}
        className="relative z-10 grid size-11 place-items-center rounded-full text-text hover:bg-card focus-visible:outline-2"
      >
        <span aria-hidden="true" className="mn-burger">
          <i />
          <i />
        </span>
      </button>
      <div
        ref={panel}
        id="mobile-menu"
        role="dialog"
        aria-label="Menu"
        inert={!open}
        data-open={open}
        className="mn-panel fixed inset-x-0 top-0 z-0 h-dvh overscroll-contain"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("a, button")) close(true);
        }}
      >
        <div className="mx-auto flex h-full w-full max-w-[560px] flex-col overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[88px]">
          <nav aria-label="Sections">
            <ul className="group/list border-t border-separator">
              {NAV_LINKS.map((link, i) => (
                <li key={link.href} className="mn-item border-b border-separator" style={{ "--i": i } as React.CSSProperties}>
                  <Link
                    href={link.href}
                    onClick={() => close()}
                    className="flex items-center justify-between py-4 text-[32px] font-bold leading-none tracking-[-0.035em] text-text transition-colors group-hover/list:text-text-tertiary hover:text-text focus-visible:outline-2"
                  >
                    {link.label}
                    <ArrowRightIcon className="size-6 text-text-tertiary" />
                  </Link>
                </li>
              ))}
              <li className="mn-item border-b border-separator" style={{ "--i": NAV_LINKS.length } as React.CSSProperties}>
                <PresentButton onBefore={() => close()} />
              </li>
            </ul>
          </nav>
          <div className="mn-item mt-auto pt-8" style={{ "--i": NAV_LINKS.length + 1 } as React.CSSProperties} onClick={() => close()}>
            <ButtonLink href="#contact" variant="solid" size="lg" className="w-full">
              Book a demo
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
