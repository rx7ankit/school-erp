import { CheckIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { PRICE_PER_STUDENT_RUPEES, formatRupees, monthlyBill } from "@/lib/pricing";

const INCLUDED = [
  "Attendance with half-days and stats",
  "Student records with full history, and a clean way to mark a student as left",
  "Year-end promotion for the whole school",
  "Admissions and Excel import of students",
  "Fees recorded for offline collection, with receipts",
  "Library issue and return",
  "Staff directory with permission-based access and class teachers",
  "Results published to parents by the class teacher",
  "Subject-wise class broadcasts and personal messages to parents",
  "Notices and holiday calendar",
  "Parent app and web view, one login for several children",
  "Web, iPhone and Android for staff",
  "Everything shown in Indian time (IST)",
] as const;

const EXAMPLE_STUDENTS = 500;

export function PricingCard() {
  return (
    <div className="grid gap-10 rounded-[28px] bg-card p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:p-14">
      <div className="flex flex-col">
        <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-text-secondary">One simple price</p>
        <p className="mt-5 flex flex-wrap items-baseline gap-x-3 font-bold tracking-[-0.04em]">
          <span className="text-[clamp(4.5rem,13vw,7.5rem)] leading-none">{formatRupees(PRICE_PER_STUDENT_RUPEES)}</span>
          <span className="dim text-[clamp(1.25rem,2.4vw,1.75rem)] leading-tight tracking-[-0.02em]">per student per month</span>
        </p>
        <p className="mt-5 max-w-md text-[17px] leading-[1.6] text-text-secondary">
          Everything in the list is included. Web, iPhone, Android and the parent app. No other plans, no add-ons.
        </p>

        <div className="mt-8 rounded-[20px] bg-bg p-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary">A quick example</p>
          <p className="mt-2 text-[17px] font-bold tracking-[-0.01em]">
            {EXAMPLE_STUDENTS} students × {formatRupees(PRICE_PER_STUDENT_RUPEES)} = {formatRupees(monthlyBill(EXAMPLE_STUDENTS))} a month
          </p>
          <p className="mt-3 text-[14px] leading-[1.55] text-text-secondary">
            Billed monthly, per active student. Students who have left school are not counted.
          </p>
        </div>

        <div className="mt-8">
          <ButtonLink href="#contact" variant="accent" size="lg">
            Book a demo
          </ButtonLink>
        </div>
      </div>

      <div>
        <h3 className="text-[20px] font-bold tracking-[-0.01em]">What is included</h3>
        <ul className="mt-5 flex flex-col gap-3.5">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-3 text-[16px] leading-[1.45]">
              <CheckIcon className="mt-0.5 size-5 text-success" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
