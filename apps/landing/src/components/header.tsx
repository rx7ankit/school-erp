import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { ButtonLink } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/nav";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="#top" aria-label="Scool, back to top" className="rounded-full focus-visible:outline-2">
          <Logo className="h-6" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-[14px] font-medium text-text-secondary hover:text-text focus-visible:outline-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <ButtonLink href="#contact" variant="solid" className="h-10 px-4 text-[14px]">
            Book a demo
          </ButtonLink>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
