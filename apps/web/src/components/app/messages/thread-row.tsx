import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ClassTeacherTag, SubjectTag, UnreadDot, whenShort } from "./bits";

/** One conversation in a list. Previous (inactive) teachers are greyed out and never show unread. */
export function ThreadRow({ avatarName, title, subtitle, subject, classTeacher, preview, at, unread, inactiveNote, selected, onClick }: {
  avatarName: string; title: string; subtitle?: string; subject: string; classTeacher?: boolean; preview?: string; at?: string;
  unread?: boolean; inactiveNote?: string; selected?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-current={selected || undefined}
      className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-card-hover", selected && "bg-fill", inactiveNote && "opacity-60")}
    >
      <Avatar name={avatarName} className="size-10" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-bold">{title}</span>
          {at && <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{whenShort(at)}</span>}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {classTeacher && <ClassTeacherTag />}
          <SubjectTag subject={subject} />
          {subtitle && <span className="truncate text-xs text-text-tertiary">{subtitle}</span>}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{inactiveNote ?? preview ?? "No messages yet"}</span>
          {unread && !inactiveNote && <UnreadDot />}
        </span>
      </span>
    </button>
  );
}
