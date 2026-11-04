"use client";
import * as React from "react";
import { AlertCircle, Lock, Paperclip } from "lucide-react";
import { toast } from "sonner";
import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Appear, SkPage, SkeletonText } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { openParentAttachment } from "@/lib/api/hooks/parent-comms";
import { useT } from "@/lib/parent-i18n";

/** A message a parent can read: the API's own words for rejected input, a translated sentence for everything else. */
export function useErrText() {
  const t = useT();
  return React.useCallback((e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.code === "child_read_only") return t("pl.readOnly");
      if (e.status === 0 || e.code === "upload_failed") return e.status === 0 && e.code !== "upload_failed" ? t("pl.offline") : e.message;
      if (e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429) return e.message;
    }
    return t("pl.error");
  }, [t]);
}

export function ErrorCard({ error, retry, fetching }: { error: unknown; retry?: () => void; fetching?: boolean }) {
  const t = useT(), text = useErrText();
  return (
    <Card role="alert" className="flex flex-wrap items-center gap-3 py-4 text-sm">
      <AlertCircle className="size-5 shrink-0 text-danger" /><span className="min-w-0 flex-1">{text(error)}</span>
      {retry && <Button size="sm" variant="secondary" loading={fetching} onClick={retry}>{t("pl.retry")}</Button>}
    </Card>
  );
}

/** Text-line placeholder with one translated "Loading" for screen readers. Sits inside a card or on its own. */
export function LoadingLines({ lines = 3, className }: { lines?: number; className?: string }) {
  const t = useT();
  return <div role="status" aria-busy="true" className={className}><span className="sr-only">{t("app.loading")}</span><SkeletonText lines={lines} /></div>;
}

/** A card of placeholder lines, for a screen that is one card. */
export function LoadingCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return <Card className={className}><LoadingLines lines={lines} /></Card>;
}

/** A whole loading screen below a real page title. Gives screen readers one translated "Loading". */
export function ParentSk({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = useT();
  return <SkPage label={t("app.loading")} className={className}>{children}</SkPage>;
}

/** Loading, error (with retry) or the content. Keeps showing old data while a refetch fails. Loaded content fades and slides up. */
export function Loaded<T>({ q, children, loading, className, i = 0 }: { q: UseQueryResult<T>; children: (data: T) => React.ReactNode; loading?: React.ReactNode; className?: string; i?: number }) {
  if (q.data !== undefined) return <Appear className={className} i={i}>{children(q.data)}</Appear>;
  if (q.isError) return <ErrorCard error={q.error} retry={() => void q.refetch()} fetching={q.isFetching} />;
  return <>{loading ?? <LoadingLines />}</>;
}

/** Shown on pages that change something, for a child who has left. */
export function ReadOnlyNote({ name }: { name: string }) {
  const t = useT();
  return <Card role="status" className="flex items-start gap-2.5 py-4 text-sm text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0" /><p>{t("pl.leftNote", { name })}</p></Card>;
}

/** A file chip: asks the API for a short-lived link when pressed. */
export function AttachmentChip({ a }: { a: { id: string; filename: string; size_bytes: number } }) {
  const err = useErrText();
  const [busy, setBusy] = React.useState(false);
  const size = a.size_bytes / 1024 < 1024 ? `${Math.max(1, Math.round(a.size_bytes / 1024))} KB` : `${(a.size_bytes / 1048576).toFixed(1)} MB`;
  return (
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await openParentAttachment(a.id); } catch (e) { toast.error(err(e)); } finally { setBusy(false); } }}
      className="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-xs text-foreground hover:bg-separator disabled:opacity-60">
      <Paperclip className="size-3.5 shrink-0" /><span className="truncate">{a.filename}</span><span className="shrink-0 text-text-tertiary">{size}</span>
    </button>
  );
}
