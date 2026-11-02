"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { ParentCalendarDay } from "@/lib/api/hooks/parent";
import type { TKey } from "@/lib/parent-i18n";
import { useT } from "@/lib/parent-i18n";

export type Mark = "present" | "absent" | "half" | "leave" | "holiday" | "none";

/** One calendar day from the API as the mark the portal shows. Sundays have no school and no record. */
export function markOf(day: ParentCalendarDay | undefined, dateOn: string): Mark {
  if (day?.holiday) return "holiday";
  switch (day?.status) {
    case "full": return "present";
    case "half": return "half";
    case "absent": return "absent";
    case "leave": return "leave";
  }
  return new Date(`${dateOn}T00:00:00Z`).getUTCDay() === 0 ? "holiday" : "none";
}

/** "09:00:00" -> "9:00 am". */
export const clock12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };

/** The month "2026-11" of a date. */
export const monthOf = (dateOn: string) => dateOn.slice(0, 7);
export const shiftMonth = (ym: string, d: number) => { const [y, m] = ym.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };

export const firstName = (name: string) => name.split(" ")[0];

/** A card whose own data loads on its own, so one slow or failed call never blanks the page. */
export function SectionCard<T>({ title, q, link, linkKey, aside, children }: {
  title: string; q: UseQueryResult<T>; link?: string; linkKey?: TKey; aside?: React.ReactNode; children: (d: T) => React.ReactNode;
}) {
  const t = useT();
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle>{aside}</CardHeader>
      {q.data !== undefined ? children(q.data)
        : q.isError ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{t("pl.error")}</span><Button size="sm" variant="secondary" loading={q.isFetching} onClick={() => void q.refetch()}>{t("pl.retry")}</Button></div>
        : <p role="status" className="text-sm text-muted-foreground">{t("app.loading")}</p>}
      {link && linkKey && <Link href={link} className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">{t(linkKey)} <ArrowRight className="size-4" /></Link>}
    </Card>
  );
}
