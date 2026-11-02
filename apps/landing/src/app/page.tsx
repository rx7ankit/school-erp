import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Intro } from "@/components/intro/intro";
import { Ambient } from "@/components/motion";
import { Contact } from "@/components/sections/contact";
import { Hero } from "@/components/sections/hero";
import { Software } from "@/components/sections/software";
import { Pricing } from "@/components/sections/pricing";
import { Who } from "@/components/sections/who";

/**
 * Flow: hero, the software, who it is for (and how it helps), pricing, contact. The deck mirrors it.
 * The fixed ambient background shows through the hero only; everything below sits on a white sheet that slides over it.
 */
export default function Home() {
  return (
    <>
      <Ambient />
      <Intro />
      <Header />
      <main id="main">
        <Hero />
        <div className="relative z-10 -mt-8 rounded-t-[40px] bg-bg">
          <Software />
          <Who />
          <Pricing />
          <Contact />
        </div>
      </main>
      <div className="relative z-10 bg-[#F3F3F6]">
        <Footer />
      </div>
    </>
  );
}
