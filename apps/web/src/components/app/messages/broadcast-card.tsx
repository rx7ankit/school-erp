import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { className, CLASSES } from "@/lib/mock";
import { SCHOOL_SUBJECT, type Broadcast } from "@/lib/messaging";
import { useData, useFmt, useTr } from "@/lib/lang-context";
import { AttachmentChip, SubjectTag, UnreadDot } from "./bits";

/** Where a broadcast went, as chips: "Whole school", "Class 8-B" or several classes. */
export function ScopeChips({ b }: { b: Broadcast }) {
  if (b.scope === "school" && b.classIds.length === 0) return <Badge>Whole school</Badge>;
  const ids = b.classIds.filter((id) => CLASSES.some((c) => c.id === id));
  return <>{ids.map((id) => <Badge key={id}>Class {className(id)}</Badge>)}</>;
}

/** One broadcast: sender, tag, text, attachment, IST time. `showScope` adds the class chips (staff view). */
export function BroadcastCard({ b, unread = false, showScope = false }: { b: Broadcast; unread?: boolean; showScope?: boolean }) {
  const tr = useTr(), d = useData(), f = useFmt();
  return (
    <article className="flex gap-3" aria-label={tr("upd.aria", "{what} from {who}", { what: b.subject === SCHOOL_SUBJECT ? tr("upd.schoolNotice", "School notice") : d(b.subject), who: b.senderName })}>
      <Avatar name={b.senderName} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-bold">{b.senderName}</span>
          <SubjectTag subject={b.subject} />
          {showScope && <ScopeChips b={b} />}
          <span className="ml-auto flex items-center gap-2 text-xs tabular-nums text-text-tertiary">{unread && <UnreadDot />}{f.ist(b.sentAt)}</span>
        </div>
        <p className="whitespace-pre-line break-words text-sm">{d(b.body)}</p>
        {b.file && <AttachmentChip name={b.file} />}
      </div>
    </article>
  );
}
