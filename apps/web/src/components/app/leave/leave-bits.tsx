import { Badge } from "@/components/ui/badge";
import { formatDateOn } from "@/lib/time";
import { useFmt, useTr } from "@/lib/lang-context";
import type { LeaveHalf, LeaveRequest, LeaveStatus } from "@/lib/leave";

const STATUS: Record<LeaveStatus, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  pending: { label: "Pending", tone: "warning" }, approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" }, cancelled: { label: "Cancelled", tone: "neutral" },
};
export const statusLabel = (s: LeaveStatus) => STATUS[s].label;
export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const tr = useTr();
  return <Badge tone={STATUS[status].tone}>{tr(`lv.s.${status}`, STATUS[status].label)}</Badge>;
}

export const HALF_LABEL: Record<LeaveHalf, string> = { none: "Full day", first: "First half", second: "Second half" };

type Range = Pick<LeaveRequest, "fromOn" | "toOn" | "half">;
const spanDays = (l: Range) => Math.round((Date.parse(`${l.toOn}T00:00:00Z`) - Date.parse(`${l.fromOn}T00:00:00Z`)) / 86_400_000) + 1;

/** "3 Nov – 4 Nov 2026 · 2 days" or "2 Nov 2026 · Second half". */
export function rangeLabel(l: Range): string {
  if (l.fromOn === l.toOn) return `${formatDateOn(l.fromOn)}${l.half !== "none" ? ` · ${HALF_LABEL[l.half]}` : ""}`;
  return `${formatDateOn(l.fromOn, "short")} – ${formatDateOn(l.toOn)} · ${spanDays(l)} days`;
}

/** The same label, in the parent's language when inside the parent portal. */
export function useRangeLabel() {
  const tr = useTr(), f = useFmt();
  return (l: Range): string => {
    if (l.fromOn === l.toOn) return `${f.on(l.fromOn)}${l.half !== "none" ? ` · ${tr(`lv.h.${l.half}`, HALF_LABEL[l.half])}` : ""}`;
    return `${f.on(l.fromOn, "short")} – ${f.on(l.toOn)} · ${tr("lv.days", "{n} days", { n: spanDays(l) })}`;
  };
}
