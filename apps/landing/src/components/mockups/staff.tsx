import { cn } from "@/lib/cn";
import { MAvatar, MBadge, MPanel, Mockup, MWindow } from "./parts";

type Person = {
  name: string;
  title: string;
  classTeacher?: string;
  perms: readonly string[];
};

const PEOPLE: readonly Person[] = [
  { name: "Sunita Tripathi", title: "Principal", perms: ["Fees", "Library", "Staff", "Academic"] },
  { name: "Rakesh Dubey", title: "Teacher", classTeacher: "8-B", perms: [] },
  { name: "Meena Gupta", title: "Teacher", classTeacher: "5-C", perms: ["Academic"] },
  { name: "Anil Kushwaha", title: "Accountant", perms: ["Fees"] },
  { name: "Pooja Sharma", title: "Librarian", perms: ["Library"] },
];

const ALL = ["Fees", "Library", "Staff", "Academic"] as const;

/** Staff directory with permission chips and class-teacher badges. */
export function StaffMockup() {
  return (
    <Mockup>
      <MWindow title="Staff · Directory">
        <div className="px-4 pb-4">
          <MPanel className="p-2">
            <div className="flex flex-col">
              {PEOPLE.map((p) => (
                <div key={p.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] px-2 py-2.5">
                  <MAvatar name={p.name} />
                  <div className="min-w-0 flex-1 basis-[120px]">
                    <p className="truncate text-[12px] font-semibold">{p.name}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-text-tertiary">
                      {p.title}
                      {p.classTeacher ? <MBadge tone="brand" className="h-5 px-2 text-[10px]">Class teacher {p.classTeacher}</MBadge> : null}
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
                          {perm}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </MPanel>
          <p className="mt-3 px-1 text-[11px] text-text-tertiary">Permissions are fixed: fees, library, staff and academic. Class teachers mark attendance and publish results.</p>
        </div>
      </MWindow>
    </Mockup>
  );
}
