import { Badge } from "@/components/ui/badge";
import { formatDateOn } from "@/lib/time";
import type { LeaveHalf, LeaveRequest, LeaveStatus } from "@/lib/leave";

const STATUS: Record<LeaveStatus, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  pending: { label: "Pending", tone: "warning" }, approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" }, cancelled: { label: "Cancelled", tone: "neutral" },
};
export const statusLabel = (s: LeaveStatus) => STATUS[s].label;
export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

export const HALF_LABEL: Record<LeaveHalf, string> = { none: "Full day", first: "First half", second: "Second half" };

/** "3 Nov – 4 Nov 2026 · 2 days" or "2 Nov 2026 · Second half". */
export function rangeLabel(l: Pick<LeaveRequest, "fromOn" | "toOn" | "half">): string {
  if (l.fromOn === l.toOn) return `${formatDateOn(l.fromOn)}${l.half !== "none" ? ` · ${HALF_LABEL[l.half]}` : ""}`;
  const days = Math.round((Date.parse(`${l.toOn}T00:00:00Z`) - Date.parse(`${l.fromOn}T00:00:00Z`)) / 86_400_000) + 1;
  return `${formatDateOn(l.fromOn, "short")} – ${formatDateOn(l.toOn)} · ${days} days`;
}
