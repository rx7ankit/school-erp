import { Eyebrow } from "@/components/section";
import { Heading } from "@/components/heading";

const BENEFITS = [
  {
    title: "Simple for teachers",
    body: "Mark a class in a minute, with half-days. Enter results once and publish when you are ready. No training manual needed.",
  },
  {
    title: "Calm for parents",
    body: "One login, one clear app. Attendance, results, notices and messages for each child, without noise.",
  },
  {
    title: "Every record in one place",
    body: "Admission to leaving school, each student has a full history. Fees, library and staff sit alongside it.",
  },
] as const;

export function Benefits() {
  return (
    <section id="benefits" aria-labelledby="benefits-heading" className="px-4 py-12 sm:px-6 md:py-16">
      <div className="mx-auto w-full max-w-[1200px]">
        <Eyebrow>Built for schools like yours</Eyebrow>
        <Heading id="benefits-heading" lead="Made for the way local schools work." dim="Not for a spreadsheet of features." className="max-w-3xl" />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="rounded-[24px] bg-card p-7 md:p-8">
              <h3 className="text-[22px] font-bold leading-tight tracking-[-0.02em]">{benefit.title}</h3>
              <p className="mt-3 text-[16px] leading-[1.6] text-text-secondary">{benefit.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
