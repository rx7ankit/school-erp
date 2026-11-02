/** All landing copy in one place. English only, short on purpose. */

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#roles", label: "Who it's for" },
  { href: "#parents", label: "Parent app" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export const HERO = {
  title: "Run your school, calmly.",
  line: "Attendance, fees and results in one simple app.",
  primary: "Book a demo",
  secondary: "See how it works",
  facts: ["Web", "iPhone", "Android"],
} as const;

export const FEATURES_HEAD = { title: "Everything included", line: "One system for the whole school." } as const;

export const FEATURES = [
  { id: "attendance", icon: "attendance", title: "One-tap attendance", line: "Mark a class in seconds. Parents hear instantly." },
  { id: "fees", icon: "fees", title: "Fee collection", line: "Receipts, dues and reminders without the register." },
  { id: "results", icon: "results", title: "Report cards", line: "Enter marks once. Publish when ready." },
  { id: "messages", icon: "messages", title: "Parent messages", line: "Notices and class updates reach every parent." },
  { id: "timetable", icon: "timetable", title: "Clash-free timetable", line: "Periods planned for every class and teacher." },
] as const;

export const ALSO = ["Student records", "Admissions", "Library", "Staff roles", "Notices", "Excel import", "Year-end promotion"] as const;

export const ROLES_HEAD = { title: "Made for everyone", line: "A calm view for each person." } as const;
export const ROLES = [
  { id: "owner", title: "School owners", line: "The whole school, at a glance." },
  { id: "teacher", title: "Teachers", line: "Mark, grade and message in minutes." },
  { id: "parent", title: "Parents", line: "Know what happened at school, instantly." },
] as const;

export const PARENT_HEAD = { title: "The parent app", line: "On iPhone and Android, plus the web." } as const;
export const PARENT_POINTS = [
  { icon: "bell", title: "Instant alerts", line: "Present, absent or half-day, right away." },
  { icon: "users", title: "Many children", line: "One login, switch between them." },
  { icon: "receipt", title: "Fee receipts", line: "Download any receipt as a PDF." },
] as const;

export const PRICING = {
  title: "Simple pricing",
  line: "One price. Everything included.",
  amount: "₹10",
  per: "per student / month",
  bullets: ["Every feature included", "Web, iPhone and Android", "Parent app and alerts", "Excel import and export", "Left students never billed"],
  cta: "Book a demo",
  example: { students: "400 students", total: "₹4,000 a month" },
} as const;

export const FAQ_HEAD = { title: "Quick answers", line: "Still unsure? Ask us in the demo." } as const;
export const FAQS = [
  { q: "Can parents pay online?", a: "No, fees are paid at school; parents see dues and receipts." },
  { q: "Who sees what?", a: "Each person gets only the access their role needs." },
  { q: "What if a student leaves?", a: "Their history is kept and they are no longer billed." },
  { q: "Can we import from Excel?", a: "Yes, import students and export any record." },
] as const;

export const CONTACT = {
  title: "Book a demo",
  line: "We reply within one working day.",
  labels: {
    name: "Your name",
    school: "School name",
    city: "City",
    phone: "Mobile number",
    email: "Email",
    role: "I am a",
    message: "Message (optional)",
  },
  choose: "Choose one",
  roles: { principal: "Principal", teacher: "Teacher", other: "Other" },
  errors: {
    name: "Please enter your name.",
    school: "Please enter your school's name.",
    city: "Please enter your city.",
    phone: "Enter a 10-digit mobile number.",
    email: "Enter a valid email address.",
    role: "Please choose one.",
    message: "Please keep it under 1000 characters.",
  },
  failed: "Something went wrong. Please check the fields or try again.",
  submit: "Request a demo",
  sending: "Sending",
  goal: "Free, no obligation.",
  thanksTitle: "Thank you.",
  thanksLine: "We have your request and will be in touch.",
  another: "Send another",
} as const;

export const FOOTER = { blurb: "School software for Indian schools.", copy: "© 2026 Krevo. krevo.tech" } as const;
