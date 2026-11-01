import Link from "next/link";
import { Logo } from "@/components/logo";
import { NAV_LINKS } from "@/lib/nav";

export function Footer() {
  return (
    <footer className="px-4 pb-10 pt-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 border-t border-separator pt-10 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Logo className="h-7" />
          <p className="mt-4 text-[15px] leading-[1.55] text-text-secondary">
            School management for local schools in Rewa, Madhya Pradesh. Built so the whole school can run on one calm system.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-8 gap-y-3 text-[15px] font-medium">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-text-secondary hover:text-text focus-visible:outline-2">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="#contact" className="text-text-secondary hover:text-text focus-visible:outline-2">
                Book a demo
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-10 w-full max-w-[1200px] text-[13px] text-text-tertiary">© 2026 Scool. All times in India Standard Time (IST).</p>
    </footer>
  );
}
