import { OwnerScene, ParentScene, TeacherScene } from "@/components/art/scenes";
import { InView } from "@/components/in-view";
import { HELPS_LABEL, ROLES } from "@/lib/content";

/** Swap any illustration for a real photo: pass photo="/images/roles-owner.jpg" (see README, Images). */
export const ROLE_ART = {
  owner: <OwnerScene />,
  teacher: <TeacherScene />,
  parent: <ParentScene />,
} as const;

export function RolesGrid() {
  return (
    <ul className="grid gap-4 md:grid-cols-3 md:gap-5">
      {ROLES.map((r, i) => (
        <InView as="li" reveal delay={i * 110} key={r.id} className="group">
          <div className="overflow-hidden rounded-[28px]">
            <div className="transition-transform duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none">{ROLE_ART[r.id]}</div>
          </div>
          <div className="px-1.5 pb-2 pt-4">
            <h3 className="text-[24px] font-bold tracking-[-0.02em]">{r.title}</h3>
            <p className="mt-1.5 text-[16px] leading-snug text-text-secondary">{r.line}</p>
            <p className="mt-3 flex items-center gap-2.5 text-[15px] font-semibold leading-snug">
              <span className="shrink-0 rounded-full bg-fill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{HELPS_LABEL}</span>
              {r.helps}
            </p>
          </div>
        </InView>
      ))}
    </ul>
  );
}
