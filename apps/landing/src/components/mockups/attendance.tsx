import { cn } from "@/lib/cn";
import { MAvatar, MBadge, MPanel, MStat, Mockup, MWindow } from "./parts";

type Half = "P" | "A";
type Row = { name: string; first: Half; second: Half; pct: string };

const ROWS: readonly Row[] = [
  { name: "Aarav Tiwari", first: "P", second: "P", pct: "96%" },
  { name: "Ananya Mishra", first: "P", second: "P", pct: "98%" },
  { name: "Ishita Pandey", first: "P", second: "A", pct: "91%" },
  { name: "Kabir Singh", first: "A", second: "A", pct: "84%" },
  { name: "Riya Dwivedi", first: "P", second: "P", pct: "95%" },
  { name: "Shivam Kushwaha", first: "A", second: "P", pct: "89%" },
];

function HalfPill({ label, value }: { label: string; value: Half }) {
  const present = value === "P";
  return (
    <span
      className={cn(
        "grid h-7 w-[86px] shrink-0 place-items-center rounded-full text-[11px] font-semibold",
        present ? "bg-solid text-on-solid" : "bg-fill text-danger",
      )}
    >
      {label} {present ? "Present" : "Absent"}
    </span>
  );
}

/** Attendance marking for class 8-B with first-half / second-half toggles and stats. */
export function AttendanceMockup() {
  return (
    <Mockup>
      <MWindow title="Attendance · Class 8-B">
        <div className="px-4 pb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[18px] font-bold tracking-[-0.02em]">Class 8-B</p>
              <p className="text-[11px] text-text-tertiary">Monday, 2 Nov 2026 · Saved 9:58 am IST</p>
            </div>
            <MBadge tone="success">Marked</MBadge>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MStat label="Present" value="35" />
            <MStat label="Half-day" value="2" tone="warning" />
            <MStat label="Absent" value="3" tone="danger" />
          </div>

          <MPanel className="mt-2 p-2">
            <div className="flex flex-col">
              {ROWS.map((row) => {
                const half = row.first !== row.second;
                return (
                  <div key={row.name} className="flex items-center gap-2 rounded-[12px] px-2 py-2">
                    <MAvatar name={row.name} className="size-7 text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold">{row.name}</p>
                      <p className="text-[10px] text-text-tertiary">
                        {half ? "Half-day counts as 0.5" : `This term ${row.pct}`}
                      </p>
                    </div>
                    <div className="hidden gap-1.5 @sm:flex">
                      <HalfPill label="AM" value={row.first} />
                      <HalfPill label="PM" value={row.second} />
                    </div>
                    <span className="@sm:hidden">
                      <MBadge tone={half ? "warning" : row.first === "P" ? "success" : "danger"}>
                        {half ? "Half" : row.first === "P" ? "Present" : "Absent"}
                      </MBadge>
                    </span>
                  </div>
                );
              })}
            </div>
          </MPanel>
        </div>
      </MWindow>
    </Mockup>
  );
}
