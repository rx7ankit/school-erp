import { Faq, type FaqItem } from "@/components/faq";
import { Heading } from "@/components/heading";
import { Eyebrow, Section } from "@/components/section";

const ITEMS: readonly FaqItem[] = [
  {
    question: "Which time zone does Scool use?",
    answer:
      "Everything is shown in Indian Standard Time (IST), whatever device or country you open it from. Attendance days, fee due dates and message times all follow the school's local time.",
  },
  {
    question: "Who can see what?",
    answer:
      "Access is set per person. Staff get fees, library, staff or academic permissions, and class teachers handle attendance and results for their own class. Parents see only their own children.",
  },
  {
    question: "Can parents pay fees online?",
    answer:
      "No. Fees are paid at school, as they are today. Staff record each payment and give a receipt, and parents can see their receipts and what is due in the app.",
  },
  {
    question: "What happens when a student leaves?",
    answer:
      "Staff mark the student as left, with a date and a reason. Their full history stays, they are not counted for billing and they get no new attendance or invoices. Existing dues stay visible to fees staff, and the parent view becomes read-only. A student can rejoin later.",
  },
  {
    question: "Do you support Excel import?",
    answer:
      "Yes. You can import students from an Excel file, and the rows are checked before anything is saved. Parent logins can be created from a list of email addresses too.",
  },
  {
    question: "Which devices does it work on?",
    answer:
      "Staff can use Scool on the web, on iPhone and on Android. Parents get a simple app for iPhone and Android, and can also sign in on the web.",
  },
];

export function FaqSection() {
  return (
    <Section id="faq" labelledBy="faq-heading">
      <div className="mx-auto max-w-3xl">
        <Eyebrow>FAQ</Eyebrow>
        <Heading id="faq-heading" lead="Honest answers." dim="To the questions we hear most." />
        <div className="mt-10">
          <Faq items={ITEMS} />
        </div>
      </div>
    </Section>
  );
}
