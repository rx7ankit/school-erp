import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { PresentProvider } from "@/components/present/present-provider";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const TITLE = "Krevo: school management made easy";
const DESCRIPTION = "School management made easy. Attendance, fees, results and parent updates in one simple app for Indian schools. ₹10 per student per month.";

export const metadata: Metadata = {
  metadataBase: new URL("https://krevo.tech"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/", siteName: "Krevo", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#ECECF0", colorScheme: "light", viewportFit: "cover" };

/* Runs before first paint. `js` lets CSS hide reveal-on-scroll content only when JavaScript is available.
   `data-intro="play"` shows the first-visit intro (once per session; never with a hash or reduced motion).
   The timeout is a safety net: if the app never hydrates the overlay cannot trap the page. */
const jsFlag = `(function(){var d=document.documentElement;d.classList.add("js");try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&!location.hash&&!sessionStorage.getItem("krevo-intro")){d.dataset.intro="play";setTimeout(function(){if(d.dataset.intro==="play"){d.dataset.intro="done";d.dataset.introLogo="1";d.dataset.hero="go"}},8000)}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" data-theme="light" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: jsFlag }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-solid focus:px-5 focus:py-3 focus:text-on-solid"
        >
          Skip to content
        </a>
        <SmoothScroll>
          <PresentProvider>{children}</PresentProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
