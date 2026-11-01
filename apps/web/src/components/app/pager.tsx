"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Client-side paging. Swap for server paging when the API exists. */
export function usePaged<T>(items: T[], size = 12) {
  const [page, setPage] = React.useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const safe = Math.min(page, pages - 1);
  return { rows: items.slice(safe * size, safe * size + size), page: safe, pages, total: items.length, size, setPage };
}

export function Pager({ page, pages, total, size, setPage }: Pick<ReturnType<typeof usePaged>, "page" | "pages" | "total" | "size" | "setPage">) {
  if (total <= size) return null;
  const from = page * size + 1, to = Math.min(total, (page + 1) * size);
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
      <span className="tabular-nums">{from}–{to} of {total}</span>
      <div className="flex gap-2">
        <Button variant="secondary" size="icon-sm" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
        <Button variant="secondary" size="icon-sm" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
      </div>
    </div>
  );
}
