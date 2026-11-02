import { Noto_Sans_Devanagari } from "next/font/google";
import { ParentShell } from "@/components/parent-shell";
import { LanguageProvider } from "@/lib/parent-i18n";

// Plus Jakarta Sans has no Devanagari. This is the fallback that Hindi text falls through to (see globals.css).
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["500", "700"],
  variable: "--font-devanagari",
  display: "swap",
});

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider fontClass={devanagari.variable}>
      <ParentShell fontClass={devanagari.variable}>{children}</ParentShell>
    </LanguageProvider>
  );
}
