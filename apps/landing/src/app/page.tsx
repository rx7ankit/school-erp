import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Benefits } from "@/components/sections/benefits";
import { Contact } from "@/components/sections/contact";
import { FaqSection } from "@/components/sections/faq-section";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { ParentApp } from "@/components/sections/parent-app";
import { Pricing } from "@/components/sections/pricing";
import { Roles } from "@/components/sections/roles";

export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <Benefits />
        <Features />
        <ParentApp />
        <Roles />
        <Pricing />
        <FaqSection />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
