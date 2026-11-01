import type { Metadata } from "next";
import { Noto_Sans_Devanagari, Plus_Jakarta_Sans } from "next/font/google";
import { LangEffects } from "@/components/lang-effects";
import { SkipText } from "@/components/skip-text";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

// Plus Jakarta Sans has no Devanagari, so Hindi text falls back to Noto Sans Devanagari.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scool: school management for schools in Rewa",
  description:
    "Attendance, student records, fees, results and parent messages in one calm system. For web, iPhone and Android. ₹10 per student per month.",
};

// Apply the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("scool.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(localStorage.getItem("scool.lang")==="hi")document.documentElement.lang="hi"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${jakarta.variable} ${devanagari.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-solid focus:px-5 focus:py-3 focus:text-on-solid"
        >
          <SkipText />
        </a>
        <LangEffects />
        {children}
      </body>
    </html>
  );
}
