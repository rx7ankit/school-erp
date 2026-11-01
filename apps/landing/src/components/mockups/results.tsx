"use client";

import { useT } from "@/lib/i18n";
import { MAvatar, MBadge, MPanel, MSwitch, Mockup, MWindow } from "./parts";

const MARKS = [78, 84, 81, 72, 76];

/** Class teacher's results screen with the publish switch, plus a subject broadcast. */
export function ResultsMockup() {
  const m = useT().mock.res;
  return (
    <Mockup>
      <MWindow title={m.title}>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <MPanel className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold">{m.publish}</p>
              <p className="text-[11px] text-text-secondary">{m.publishNote}</p>
            </div>
            <MSwitch on />
          </MPanel>

          <MPanel title={m.marksOf} aside={<MBadge tone="success">{m.published}</MBadge>} className="p-3">
            <div className="flex flex-col">
              {MARKS.map((marks, index) => (
                <div key={index} className="flex items-center gap-3 px-1.5 py-1.5 text-[12px]">
                  <span className="w-[100px] shrink-0 truncate font-medium">{m.subjects[index]}</span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fill">
                    <span className="block h-full rounded-full bg-text" style={{ width: `${marks}%` }} />
                  </span>
                  <span className="w-7 text-right font-bold tabular-nums">{marks}</span>
                </div>
              ))}
            </div>
          </MPanel>

          <MPanel className="flex gap-3 p-4">
            <MAvatar name="Rakesh Dubey" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[12px] font-bold">Rakesh Dubey</p>
                <MBadge tone="brand">{m.broadcastSubject}</MBadge>
              </div>
              <p className="mt-1 text-[12px] leading-[1.45] text-text-secondary">
                {m.broadcast}
              </p>
              <p className="mt-1 text-[10px] text-text-tertiary">{m.sent}</p>
            </div>
          </MPanel>
        </div>
      </MWindow>
    </Mockup>
  );
}
