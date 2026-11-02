"use client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { className } from "@/lib/mock";
import { checkReadiness } from "@/lib/rollover";
import { formatINR } from "@/lib/time";
import { useAssignments } from "@/lib/assignments";
import { useFeesStore } from "@/lib/fees-setup";
import { useLeaves } from "@/lib/leave";
import { useRecordsVersion } from "@/lib/student-record";
import { useAcademic } from "@/lib/academic-setup";

interface Row { id: string; ok: boolean; text: string; href: string; link: string; }

/** The five readiness checks. They warn and link to the fix; none of them blocks the rollover. */
export function ReadinessList({ onLeave, compact }: { onLeave?: () => void; compact?: boolean }) {
  useAssignments(); useFeesStore(); useLeaves(); useRecordsVersion(); useAcademic(); // re-check when the user fixes something and comes back
  const r = checkReadiness();
  const rows: Row[] = [
    { id: "results", ok: r.unpublished.length === 0,
      text: r.unpublished.length ? r.unpublished.map((u) => `${u.examName} not published for ${u.classIds.map(className).join(", ")}`).join(". ") : "Results published", href: "/results", link: "Open" },
    { id: "leave", ok: r.pendingLeaves === 0, text: r.pendingLeaves ? `${r.pendingLeaves} leave requests pending` : "No pending leave", href: "/leave", link: "Open" },
    { id: "fees", ok: r.unpaid.students === 0, text: r.unpaid.students ? `${formatINR(r.unpaid.paise)} unpaid by ${r.unpaid.students} students` : "No unpaid fees", href: "/fees", link: "Open" },
    { id: "ct", ok: r.noClassTeacher.length === 0, text: r.noClassTeacher.length ? `No class teacher: ${r.noClassTeacher.map(className).join(", ")}` : "Class teachers set", href: "/academic", link: "Open" },
    { id: "details", ok: r.missingDetails === 0, text: r.missingDetails ? `${r.missingDetails} students lack an emergency contact` : "Emergency contacts set", href: "/students", link: "Open" },
  ];
  return (
    <ul className="flex flex-col gap-2" aria-label="Readiness checks">
      {rows.map((x) => (
        <li key={x.id} className="flex items-start gap-3 rounded-xl bg-fill px-4 py-3 text-sm">
          {x.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="All good" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Needs a look" />}
          <span className="min-w-0 flex-1">{x.text}</span>
          {!x.ok && !compact && <Link href={x.href} onClick={onLeave} className="shrink-0 text-[13px] font-medium text-foreground hover:underline">{x.link}</Link>}
        </li>
      ))}
    </ul>
  );
}
