import { Info, Lock } from "lucide-react";

/** Replaces the composer on a previous teacher's thread (parent view). */
export function InactiveBanner({ teacher, subject, child }: { teacher: string; subject: string; child: string }) {
  return (
    <div role="status" className="flex items-start gap-2.5 border-t border-border p-4 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>{teacher} no longer teaches {subject} to {child}, so you can&apos;t reply. Messages from your current {subject} teacher are under Teachers.</p>
    </div>
  );
}

/** Replaces the composer when the child has left school. */
export function LeftNote({ child }: { child: string }) {
  return (
    <div role="status" className="flex items-start gap-2.5 border-t border-border p-4 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" />
      <p>{child} has left school, so messages are read-only. You can still read the old ones.</p>
    </div>
  );
}
