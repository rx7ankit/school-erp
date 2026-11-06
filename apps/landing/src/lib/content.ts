/** All landing copy in one place. English only, short on purpose.
 * Headings are two-tone: `title` in ink, `dim` (the continuation) in grey. */

export const NAV_LINKS = [
  { href: "#software", label: "Software" },
  { href: "#who", label: "Who it's for" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
] as const;

export const HERO = {
  title: "School management,",
  titleDim: "made easy.",
  line: "Attendance, fees, results and parent updates in one simple app for your school.",
  primary: "Book a demo",
  secondary: "See how it works",
  facts: ["Made in India", "Web, iPhone and Android", "₹10 per user a month"],
  badge: "Now with a parent app",
  deckLine: "Krevo · krevo.tech",
} as const;

export const SOFTWARE_HEAD = { title: "Everything", dim: "in one app.", line: "One system for the whole school." } as const;
export const PLATFORMS = ["Web", "iPhone", "Android"] as const;

export const FEATURES = [
  {
    id: "attendance",
    icon: "attendance",
    title: "One-tap",
    dim: "attendance.",
    name: "Attendance",
    line: "Mark a class in seconds. Parents hear instantly.",
    bullets: ["Present, absent or half-day", "Parents alerted instantly", "Daily and monthly reports"],
  },
  {
    id: "fees",
    icon: "fees",
    title: "Fee",
    dim: "collection.",
    name: "Fees",
    line: "Receipts, dues and reminders without the register.",
    bullets: ["Fee heads for every class", "Receipts in one tap", "Dues and reminders at a glance"],
  },
  {
    id: "results",
    icon: "results",
    title: "Report",
    dim: "cards.",
    name: "Results",
    line: "Enter marks once. Publish when ready.",
    bullets: ["Enter marks once", "Report card for every student", "Publish to parents when ready"],
  },
  {
    id: "messages",
    icon: "messages",
    title: "Parent",
    dim: "messages.",
    name: "Messages",
    line: "Notices and class updates reach every parent.",
    bullets: ["School-wide notices", "Class updates", "Straight to the parent app"],
  },
  {
    id: "timetable",
    icon: "timetable",
    title: "Clash-free",
    dim: "timetable.",
    name: "Timetable",
    line: "Periods planned for every class and teacher.",
    bullets: ["Periods for every class", "No teacher clashes", "Substitutes found fast"],
  },
] as const;

export const ALSO_HEAD = { title: "Also", dim: "included." } as const;
export const ALSO = ["Student records", "Admissions", "Staff roles", "Notices", "Excel import", "Year-end promotion"] as const;

export const WHO_HEAD = { title: "Made for", dim: "everyone.", line: "One clear view for each person." } as const;
export const ROLES = [
  { id: "owner", title: "School owners", line: "The whole school, at a glance.", helps: "See fees and attendance live." },
  { id: "teacher", title: "Teachers", line: "Mark, grade and message in minutes.", helps: "Less paperwork, more teaching." },
  { id: "parent", title: "Parents", line: "Know what happened at school, instantly.", helps: "Never miss a school update." },
] as const;
export const HELPS_LABEL = "How it helps";

export const PARENT_HEAD = { title: "The parent", dim: "app.", line: "On iPhone and Android, plus the web." } as const;
export const PARENT_POINTS = [
  { icon: "bell", title: "Instant alerts", line: "Present, absent or half-day, right away." },
  { icon: "users", title: "Many children", line: "One login, switch between them." },
  { icon: "receipt", title: "Fee receipts", line: "Download any receipt as a PDF." },
] as const;
export const PARENT_LANGS = "Available in English and हिन्दी";

export const PRICING = {
  title: "Simple",
  dim: "pricing.",
  line: "One price. Everything included.",
  amount: "₹10",
  per: "per user / month",
  bullets: ["Every feature included", "Web, iPhone and Android", "Parent app and alerts", "Excel import and export", "Users who leave never billed"],
  cta: "Book a demo",
  example: { students: "400 users", total: "₹4,000 a month" },
} as const;

export const FAQ_HEAD = "Quick answers";
export const FAQS = [
  { q: "Can we try it first?", a: "Yes. Start with a free trial using your own classes and students." },
  { q: "Where is our data stored?", a: "In India, on secure servers in Mumbai. Your data stays in the country." },
  { q: "Is our data private?", a: "Yes. Each school sees only its own data. We never share or sell it." },
  { q: "Is setup and support free?", a: "Yes. We set up your school, import your students and help your staff, at no cost." },
  { q: "Can parents pay online?", a: "Not yet. Fees are paid at school; parents see dues and receipts in the app." },
  { q: "Can we import from Excel?", a: "Yes. Import students from Excel and export any record." },
  { q: "What if someone leaves?", a: "Their history is kept and they are no longer billed." },
  { q: "Are backups taken?", a: "Yes. Encrypted backups run automatically, so nothing is lost." },
] as const;

export const CONTACT_STEPS = ["Tell us about your school", "See a 20-minute demo", "Start with your own data"] as const;

export const CONTACT = {
  title: "Book a",
  dim: "demo.",
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

export const FOOTER = {
  blurb: "School software",
  blurbDim: "for Indian schools.",
  copy: "© 2026 Krevo. krevo.tech",
  email: "hello@krevo.tech",
  cta: "Book a demo",
  modules: ["Attendance", "Fees", "Results", "Timetable", "Messages", "Admissions", "Notices", "Staff roles", "Parent app"],
} as const;

/** The last slide of the presentation: a warm close, not a sales ask. */
export const DECK_CLOSE = {
  title: "Welcome",
  dim: "aboard.",
  thanks: "Thank you.",
  steps: ["We set up your school", "Import your students", "Start with Krevo"],
} as const;

/* ---------- Phase 2 (reference-style lower sections) ---------- */
export const SOFTWARE_NODES = ["Attendance", "Fees", "Results", "Messages", "Timetable"] as const;
export const SOFTWARE_CARDS = [
  { id: "attendance", title: "Attendance", line: "Mark a class in seconds. Parents hear instantly." },
  { id: "fees", title: "Fees", line: "Receipts and dues without the register." },
  { id: "results", title: "Results", line: "Enter marks once. Publish when ready." },
] as const;
export const ALSO_ROW = ["Admissions", "Staff roles", "Certificates", "Excel import", "Year-end promotion"] as const;

export const WHO_CHIP = "Who it's for";
export const BENTO = {
  parents: { title: "Parents", line: "Never miss a school update. In Hindi and English." },
  owners: { title: "School owners", line: "See fees and attendance live." },
  teachers: { title: "Teachers", line: "Less paperwork, more teaching." },
  app: { title: "Parent app", line: "Instant alerts, many children, fee receipts." },
  reports: { title: "Reports", line: "Clear numbers for every class, with Excel export." },
} as const;

export const PRICING_STORY = {
  lead: "One simple price.",
  rest: "Attendance, fees, results, messages, timetable and the parent app are all included, for every user, every month. Users who leave are never billed.",
  label: "Price",
  per: "/ user / month",
} as const;

export const CONTACT_PARA = "Tell us about your school and we will show you Krevo with your own classes. We reply within one working day.";
export const FOOTER_CTA = { title: "Run your school", dim: "the easy way.", line: "A 20-minute demo, with your own data. Free, no obligation." } as const;
