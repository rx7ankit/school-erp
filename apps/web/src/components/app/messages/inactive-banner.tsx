"use client";
import { Info, Lock } from "lucide-react";
import { useData, useT } from "@/lib/parent-i18n";

/** Replaces the composer on a previous teacher's thread (parent view). */
export function InactiveBanner({ teacher, subject, child }: { teacher: string; subject: string; child: string }) {
  const t = useT(), d = useData();
  return (
    <div role="status" className="flex items-start gap-2.5 border-t border-border p-4 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>{t("msg.inactive", { teacher, subject: d(subject), child })}</p>
    </div>
  );
}

/** Replaces the composer when the child has left school. */
export function LeftNote({ child }: { child: string }) {
  const t = useT();
  return (
    <div role="status" className="flex items-start gap-2.5 border-t border-border p-4 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" />
      <p>{t("msg.leftNote", { child })}</p>
    </div>
  );
}
