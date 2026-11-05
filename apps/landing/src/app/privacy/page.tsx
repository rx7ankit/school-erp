import type { Metadata } from "next";
import Link from "next/link";
import { LOCKUP_VIEWBOX, MARK, MARK_T, WORDMARK, WORD_T } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacy policy · Krevo",
  description: "What Krevo collects, why, who sees it and how to ask for it to be changed or deleted.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "6 November 2026";
const EMAIL = "hello@krevo.tech";

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 text-[22px] font-bold tracking-[-0.02em] text-text">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[16px] leading-[1.7] text-text-secondary">{children}</p>;
}
function L({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-[1.7] text-text-secondary marker:text-text-tertiary">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export default function Privacy() {
  return (
    <main id="main" className="min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-[760px] px-5 py-10 sm:px-8 md:py-16">
        <Link href="/" aria-label="Krevo home" className="inline-block text-text">
          <svg viewBox={LOCKUP_VIEWBOX} fill="currentColor" role="img" aria-label="Krevo" className="h-7 w-auto">
            <g transform={MARK_T}>{MARK}</g>
            <path d={WORDMARK} transform={WORD_T} />
          </svg>
        </Link>

        <h1 className="mt-12 text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.05] tracking-[-0.04em] text-text">Privacy policy</h1>
        <p className="mt-3 text-[14px] text-text-tertiary">Last updated {UPDATED}</p>

        <P>
          Krevo is a school management app for parents, teachers and school staff in India. This page says what we collect, why, who can see it, and how you can
          ask us to change or delete it. We wrote it to be read, not to hide things.
        </P>

        <H>Who is responsible</H>
        <P>
          Your child&rsquo;s school decides what goes into Krevo and why. Krevo is the service it uses, and we handle the data only to run that service for the
          school. For anything about your child&rsquo;s record, the school is the first person to ask. You can also write to us at{" "}
          <a className="font-medium text-text underline underline-offset-4" href={`mailto:${EMAIL}`}>
            {EMAIL}
          </a>
          .
        </P>

        <H>What we collect</H>
        <L
          items={[
            <>
              <strong className="font-semibold text-text">Account details:</strong> name, email address, phone number and your role (parent, teacher or admin).
            </>,
            <>
              <strong className="font-semibold text-text">Student records the school enters:</strong> name, class and section, date of birth, admission number,
              attendance, leave requests, results and report cards, fee records and timetable. A student photo or documents if the school adds them.
            </>,
            <>
              <strong className="font-semibold text-text">Messages and notices:</strong> chat messages between parents and teachers, and school notices. If you
              send a photo, video or document, we store it too.
            </>,
            <>
              <strong className="font-semibold text-text">Device details for notifications:</strong> a push token that lets us send you alerts, and your language
              choice.
            </>,
            <>
              <strong className="font-semibold text-text">Basic technical logs:</strong> sign-in times and error reports, kept to keep the service secure and
              working.
            </>,
          ]}
        />
        <P>
          We do not collect your location, contacts, or advertising identifiers. The app asks to open your photos only when you choose to attach one in a chat.
        </P>

        <H>How we use it</H>
        <L
          items={[
            "To show parents their child's attendance, results, fees, notices and messages, and to let staff do their work.",
            "To send notifications and emails about the above, such as a sign-in code, a new notice or a fee reminder.",
            "To keep the service safe, fix problems and prevent misuse.",
          ]}
        />
        <P>We do not sell your data. We do not show advertisements. We do not use student data to train AI models or build marketing profiles.</P>

        <H>Who can see it</H>
        <L
          items={[
            "Only people at the same school, and only what their role allows. A parent sees their own child, a teacher sees their own classes, and each school's data is kept apart from every other school's.",
            "Our service providers, who process data for us under their own security terms: Amazon Web Services (servers, Mumbai, India), Cloudflare (file storage and network protection) and Resend (sending email). Notification services from Apple and Google deliver push alerts.",
            "Anyone the law requires us to tell, such as a court order.",
          ]}
        />

        <H>How long we keep it</H>
        <P>
          We keep a school&rsquo;s data while the school uses Krevo. When a school leaves, or when you or the school ask us to delete a record, we remove it from
          our systems, and from backups within 30 days.
        </P>

        <H>Security</H>
        <P>
          Everything travels over encrypted connections. Files are stored privately and are opened only through short-lived links. Database backups are encrypted.
          No system is perfectly safe, but we limit access, keep logs and fix problems quickly. If a breach affects you, we will tell the school and you.
        </P>

        <H>Children</H>
        <P>
          Krevo holds information about school children, which a school or parent provides. Children do not create their own accounts. Parents can ask the school
          or us to see, correct or delete their child&rsquo;s information at any time.
        </P>

        <H>Your choices</H>
        <L
          items={[
            "Ask to see, correct or delete your information, or your child's, by asking your school or writing to us.",
            "Turn off notifications in your phone's settings at any time.",
            "Ask us to delete your account. Some school records, such as fee receipts, may need to be kept for the period the law requires.",
          ]}
        />
        <P>We follow India&rsquo;s Digital Personal Data Protection Act, 2023. We reply to requests within 30 days.</P>

        <H>Changes</H>
        <P>If we change this policy in a way that matters, we will update the date at the top and tell schools in the app.</P>

        <H>Contact</H>
        <P>
          Questions or requests:{" "}
          <a className="font-medium text-text underline underline-offset-4" href={`mailto:${EMAIL}`}>
            {EMAIL}
          </a>
        </P>
      </div>
    </main>
  );
}
