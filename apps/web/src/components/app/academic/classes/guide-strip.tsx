const STEPS = [
  { n: 1, title: "Classes", text: "Add sections to grades 1 to 12 or create your own classes." },
  { n: 2, title: "Subjects", text: "Add subjects and tick which classes study them." },
  { n: 3, title: "Teachers", text: "Pick a class teacher and a teacher for each subject." },
];

/** Three-step reminder of the setup order. */
export function GuideStrip({ active }: { active?: 1 | 2 | 3 }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Setup order">
      {STEPS.map((s) => (
        <li key={s.n} className="flex items-start gap-3 rounded-[20px] bg-card p-4">
          <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${active === s.n ? "bg-brand text-brand-foreground" : "bg-fill text-muted-foreground"}`}>{s.n}</span>
          <div><p className="text-sm font-bold">{s.title}</p><p className="text-[13px] text-muted-foreground">{s.text}</p></div>
        </li>
      ))}
    </ol>
  );
}
