import { MAvatar, MBadge, MPanel, MSwitch, Mockup, MWindow } from "./parts";

const MARKS = [
  { subject: "Mathematics", marks: 78 },
  { subject: "Science", marks: 84 },
  { subject: "Hindi", marks: 81 },
  { subject: "English", marks: 72 },
  { subject: "Social Science", marks: 76 },
];

/** Class teacher's results screen with the publish switch, plus a subject broadcast. */
export function ResultsMockup() {
  return (
    <Mockup>
      <MWindow title="Results · Half-yearly · Class 8-B">
        <div className="flex flex-col gap-2 px-4 pb-4">
          <MPanel className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold">Publish to parents</p>
              <p className="text-[11px] text-text-secondary">Parents see nothing until the class teacher publishes.</p>
            </div>
            <MSwitch on />
          </MPanel>

          <MPanel title="Priya Shukla · marks out of 100" aside={<MBadge tone="success">Published</MBadge>} className="p-3">
            <div className="flex flex-col">
              {MARKS.map((m) => (
                <div key={m.subject} className="flex items-center gap-3 px-1.5 py-1.5 text-[12px]">
                  <span className="w-[100px] shrink-0 truncate font-medium">{m.subject}</span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fill">
                    <span className="block h-full rounded-full bg-text" style={{ width: `${m.marks}%` }} />
                  </span>
                  <span className="w-7 text-right font-bold tabular-nums">{m.marks}</span>
                </div>
              ))}
            </div>
          </MPanel>

          <MPanel className="flex gap-3 p-4">
            <MAvatar name="Rakesh Dubey" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[12px] font-bold">Rakesh Dubey</p>
                <MBadge tone="brand">Mathematics · 8-B</MBadge>
              </div>
              <p className="mt-1 text-[12px] leading-[1.45] text-text-secondary">
                Chapter 7 test on Wednesday. Please revise the exercises in the notebook.
              </p>
              <p className="mt-1 text-[10px] text-text-tertiary">Sent to all 40 parents · 2 Nov 2026, 9:15 am IST</p>
            </div>
          </MPanel>
        </div>
      </MWindow>
    </Mockup>
  );
}
