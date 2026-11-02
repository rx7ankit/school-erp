import Link from "next/link";
import { Logo } from "@/components/logo";
import { FOOTER, NAV_LINKS } from "@/lib/content";

export function Footer() {
  return (
    <footer className="px-4 pb-10 pt-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 border-t border-separator pt-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <Logo className="h-8" />
          <p className="text-[15px] text-text-secondary">{FOOTER.blurb}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-2 gap-y-1 text-[15px] font-medium">
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
      <p className="mx-auto mt-8 w-full max-w-[1200px] text-[13px] text-text-tertiary">{FOOTER.copy}</p>
    </footer>
  );
}
