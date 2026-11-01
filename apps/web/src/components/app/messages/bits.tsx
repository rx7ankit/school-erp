import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GENERAL, SCHOOL_SUBJECT } from "@/lib/messaging";
import { formatIST, todayOnIST } from "@/lib/time";
import { cn } from "@/lib/utils";

/** School notices are orange, subjects and General are grey. */
export function SubjectTag({ subject, className }: { subject: string; className?: string }) {
  return <Badge tone={subject === SCHOOL_SUBJECT ? "brand" : "neutral"} className={className}>{subject === GENERAL ? "General" : subject}</Badge>;
}
export const ClassTeacherTag = () => <Badge tone="brand">Class teacher</Badge>;

export function AttachmentChip({ name }: { name: string }) {
  return <span className="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-xs"><Paperclip className="size-3.5 shrink-0" /><span className="truncate">{name}</span></span>;
}

/** Orange unread marker. Text for screen readers. */
export function UnreadDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full bg-brand", className)}><span className="sr-only">Unread</span></span>;
}

/** Time for a list row: the time today, otherwise the short date. IST. */
export const whenShort = (utc: string) => (todayOnIST(new Date(utc)) === todayOnIST() ? formatIST(utc, "time") : formatIST(utc, "short"));
