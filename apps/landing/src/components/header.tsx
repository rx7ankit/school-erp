import Link from "next/link";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";
import { ButtonLink } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/content";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-separator/60 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <Link href="#top" aria-label="Krevo, back to top" className="-ml-1 flex h-11 shrink-0 items-center rounded-full px-1 text-text focus-visible:outline-2">
          <Logo className="h-8" />
        </Link>
        <nav aria-label="Main" className="mx-auto hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-full px-4 py-2.5 text-[15px] font-medium text-text-secondary hover:text-text focus-visible:outline-2">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <ButtonLink href="#contact" variant="solid" className="h-11 px-4 text-[14px] sm:px-5 sm:text-[15px]">
            Book a demo
          </ButtonLink>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
