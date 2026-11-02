import { OwnerScene, ParentScene, TeacherScene } from "@/components/art/scenes";
import { InView } from "@/components/in-view";
import { Section } from "@/components/section";
import { ROLES, ROLES_HEAD } from "@/lib/content";

/** Swap any illustration for a real photo: pass photo="/images/roles-owner.jpg" (see README, Images). */
const ART = {
  owner: <OwnerScene />,
  teacher: <TeacherScene />,
  parent: <ParentScene />,
} as const;

export function Roles() {
  return (
    <Section id="roles" title={ROLES_HEAD.title} line={ROLES_HEAD.line}>
      <ul className="grid gap-4 md:grid-cols-3 md:gap-5">
        {ROLES.map((r, i) => (
          <InView as="li" reveal delay={i * 110} key={r.id} className="group">
            <div className="overflow-hidden rounded-[28px]">
              <div className="transition-transform duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none">{ART[r.id]}</div>
            </div>
            <div className="px-1.5 pb-2 pt-4">
              <h3 className="text-[24px] font-bold tracking-[-0.02em]">{r.title}</h3>
              <p className="mt-1.5 text-[16px] leading-snug text-text-secondary">{r.line}</p>
            </div>
          </InView>
        ))}
      </ul>
    </Section>
  );
}
