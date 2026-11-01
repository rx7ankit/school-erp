"use client";

import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { MAvatar, MBadge, MPanel, Mockup, MWindow } from "./parts";

type Person = {
  name: string;
  title: "principal" | "teacher" | "accountant" | "librarian";
  classTeacher?: string;
  perms: readonly number[];
};

const PEOPLE: readonly Person[] = [
  { name: "Sunita Tripathi", title: "principal", perms: [0, 1, 2, 3] },
  { name: "Rakesh Dubey", title: "teacher", classTeacher: "8-B", perms: [] },
  { name: "Meena Gupta", title: "teacher", classTeacher: "5-C", perms: [3] },
  { name: "Anil Kushwaha", title: "accountant", perms: [0] },
  { name: "Pooja Sharma", title: "librarian", perms: [1] },
];

const ALL = [0, 1, 2, 3] as const;

/** Staff directory with permission chips and class-teacher badges. */
export function StaffMockup() {
  const m = useT().mock.staff;
  return (
    <Mockup>
      <MWindow title={m.title}>
        <div className="px-4 pb-4">
          <MPanel className="p-2">
            <div className="flex flex-col">
              {PEOPLE.map((p) => (
                <div key={p.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] px-2 py-2.5">
                  <MAvatar name={p.name} />
                  <div className="min-w-0 flex-1 basis-[120px]">
                    <p className="truncate text-[12px] font-semibold">{p.name}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-text-tertiary">
                      {m[p.title]}
                      {p.classTeacher ? <MBadge tone="brand" className="h-5 px-2 text-[10px]">{m.classTeacher} {p.classTeacher}</MBadge> : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ALL.map((perm) => {
                      const on = p.perms.includes(perm);
                      return (
                        <span
                          key={perm}
                          className={cn(
                            "rounded-full px-2 py-1 text-[10px] font-semibold",
                            on ? "bg-solid text-on-solid" : "bg-fill text-text-tertiary",
                          )}
                        >
                          {m.perms[perm]}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </MPanel>
          <p className="mt-3 px-1 text-[11px] text-text-tertiary">{m.note}</p>
        </div>
      </MWindow>
    </Mockup>
  );
}
