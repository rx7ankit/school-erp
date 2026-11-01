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
      text: r.unpublished.length ? r.unpublished.map((u) => `${u.examName} results are not published for ${u.classIds.map(className).join(", ")}`).join(". ") : "All exam results are published.", href: "/results", link: "Open results" },
    { id: "leave", ok: r.pendingLeaves === 0, text: r.pendingLeaves ? `${r.pendingLeaves} leave ${r.pendingLeaves === 1 ? "request is" : "requests are"} still pending.` : "No pending leave requests.", href: "/leave", link: "Open leave" },
    { id: "fees", ok: r.unpaid.students === 0, text: r.unpaid.students ? `${formatINR(r.unpaid.paise)} is unpaid by ${r.unpaid.students} students. You can carry it forward in the Fees step.` : "No unpaid fees.", href: "/fees", link: "Open fees" },
    { id: "ct", ok: r.noClassTeacher.length === 0, text: r.noClassTeacher.length ? `No class teacher for ${r.noClassTeacher.map(className).join(", ")}.` : "Every class has a class teacher.", href: "/academic", link: "Open teachers" },
    { id: "details", ok: r.missingDetails === 0, text: r.missingDetails ? `${r.missingDetails} students have no emergency contact.` : "Every student has an emergency contact.", href: "/students", link: "Open students" },
  ];
  return (
    <ul className="flex flex-col gap-2" aria-label="Readiness checks">
      {rows.map((x) => (
        <li key={x.id} className="flex items-start gap-3 rounded-xl bg-fill px-4 py-3 text-sm">
          {x.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="All good" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Needs a look" />}
          <span className="min-w-0 flex-1">{x.text}</span>
          {!x.ok && !compact && <Link href={x.href} onClick={onLeave} className="shrink-0 text-[13px] font-medium text-brand hover:underline">{x.link}</Link>}
        </li>
      ))}
    </ul>
  );
}
