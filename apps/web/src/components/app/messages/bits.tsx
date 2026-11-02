import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useData, useFmt, useTr } from "@/lib/lang-context";
import { todayOnIST } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Subject tags are grey. */
export function SubjectTag({ subject, className }: { subject: string; className?: string }) {
  const d = useData();
  return <Badge tone={"neutral"} className={className}>{d(subject)}</Badge>;
}
export function ClassTeacherTag() {
  const tr = useTr();
  return <Badge>{tr("tag.classTeacher", "Class teacher")}</Badge>;
}

export function AttachmentChip({ name }: { name: string }) {
  return <span className="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-xs"><Paperclip className="size-3.5 shrink-0" /><span className="truncate">{name}</span></span>;
}

/** Orange unread marker. Text for screen readers. */
export function UnreadDot({ className }: { className?: string }) {
  const tr = useTr();
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full bg-foreground", className)}><span className="sr-only">{tr("tag.unread", "Unread")}</span></span>;
}

/** Time for a list row: the time today, otherwise the short date. IST. */
export function useWhenShort() {
  const f = useFmt();
  return (utc: string) => (todayOnIST(new Date(utc)) === todayOnIST() ? f.ist(utc, "time") : f.ist(utc, "short"));
}
