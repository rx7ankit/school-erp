import { SchoolArt, NotebookArt, PhoneArt } from "@/components/art/illustrations";
import { InView } from "@/components/in-view";
import { Section } from "@/components/section";
import { ROLES, ROLES_HEAD } from "@/lib/content";

const ART = { owner: <SchoolArt />, teacher: <NotebookArt />, parent: <PhoneArt /> } as const;

export function Roles() {
  return (
    <Section id="roles" title={ROLES_HEAD.title} line={ROLES_HEAD.line}>
      <ul className="grid gap-4 md:grid-cols-3 md:gap-5">
        {ROLES.map((r, i) => (
          <InView as="li" reveal delay={i * 110} key={r.id} className="group overflow-hidden rounded-[28px] bg-card">
            <div className="pt-6 transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none">{ART[r.id]}</div>
            <div className="px-6 pb-7 pt-4">
              <h3 className="text-[24px] font-bold tracking-[-0.02em]">{r.title}</h3>
              <p className="mt-1.5 text-[16px] leading-snug text-text-secondary">{r.line}</p>
            </div>
          </InView>
        ))}
      </ul>
    </Section>
  );
}
