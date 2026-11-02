import { SchoolDayBand } from "@/components/art/school-day";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Contact } from "@/components/sections/contact";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { Pricing } from "@/components/sections/pricing";
import { Who } from "@/components/sections/who";

/** Flow: hero, the software, who it is for (and how it helps), pricing, contact. The deck mirrors it. */
export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <Features />
        <SchoolDayBand />
        <Who />
        <Pricing />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
