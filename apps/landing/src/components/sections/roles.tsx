import { Heading } from "@/components/heading";
import { Eyebrow, Section } from "@/components/section";

const ROLES = [
  {
    role: "Principal",
    sees: "Everything. Attendance, fees, results, staff and students across the school, plus who has which permission.",
  },
  {
    role: "Teacher",
    sees: "Their classes. The class teacher marks attendance and publishes results; any teacher of a class can message its parents.",
  },
  {
    role: "Accountant",
    sees: "Fees only. Record payments received at school, print receipts and follow pending dues.",
  },
  {
    role: "Librarian",
    sees: "The library. Issue and return books to students and staff.",
  },
  {
    role: "Parent",
    sees: "Their own children. Attendance, published results, fee receipts, notices and messages.",
  },
] as const;

export function Roles() {
  return (
    <Section id="roles" labelledBy="roles-heading">
      <Eyebrow>Who sees what</Eyebrow>
      <Heading id="roles-heading" lead="Everyone gets the right view." dim="Set once, with clear permissions." className="max-w-3xl" />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((item) => (
          <li key={item.role} className="flex flex-col rounded-[24px] bg-card p-6">
            <h3 className="text-[22px] font-bold tracking-[-0.02em]">{item.role}</h3>
            <p className="mt-3 text-[15px] leading-[1.6] text-text-secondary">{item.sees}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
