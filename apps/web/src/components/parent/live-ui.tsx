"use client";
import * as React from "react";
import { AlertCircle, Lock } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
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

export function LoadingCard({ className }: { className?: string }) {
  const t = useT();
  return <Card role="status" aria-live="polite" className={className ?? "py-8 text-center text-sm text-muted-foreground"}>{t("app.loading")}</Card>;
}

/** Loading, error (with retry) or the content. Keeps showing old data while a refetch fails. */
export function Loaded<T>({ q, children, loading }: { q: UseQueryResult<T>; children: (data: T) => React.ReactNode; loading?: React.ReactNode }) {
  if (q.data !== undefined) return <>{children(q.data)}</>;
  if (q.isError) return <ErrorCard error={q.error} retry={() => void q.refetch()} fetching={q.isFetching} />;
  return <>{loading ?? <LoadingCard />}</>;
}

/** Shown on pages that change something, for a child who has left. */
export function ReadOnlyNote({ name }: { name: string }) {
  const t = useT();
  return <Card role="status" className="flex items-start gap-2.5 py-4 text-sm text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0" /><p>{t("pl.leftNote", { name })}</p></Card>;
}
