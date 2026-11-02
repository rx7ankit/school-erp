"use client";
import * as React from "react";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge as Badge } from "@/components/parent/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { AttachmentChip, Loaded, useErrText } from "@/components/parent/live-ui";
import { clock12 } from "@/components/parent/bits";
import { useParentDateSheet, useParentHolidays } from "@/lib/api/hooks/parent";
import { useParentUpdates, useReadAllUpdates, useReadUpdate, type ParentFeedItem } from "@/lib/api/hooks/parent-comms";
import { useData, useFmt } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";
import { useTodayIST } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const KIND = { holiday: "danger", exam: "warning", event: "neutral" } as const;

function DateSheets({ sid }: { sid: string }) {
  const t = useT(), d = useData(), f = useFmt();
  const q = useParentDateSheet(sid);
  if (!q.data?.length) return null;
  return <>{q.data.map((es) => (
    <Card key={es.id}>
      <CardHeader><CardTitle>{d(es.name)}</CardTitle><Badge tone="warning">{t("nt.dateSheet")}</Badge></CardHeader>
      <ul>{[...es.items].sort((a, b) => `${a.paper_on}${a.starts_at}`.localeCompare(`${b.paper_on}${b.starts_at}`)).map((p) => (
        <li key={`${p.subject_id}${p.paper_on}`} className="flex items-center justify-between gap-3 border-t border-border py-3 text-sm first:border-t-0 first:pt-0 last:pb-0">
          <span className="font-medium">{d(p.subject)}</span>
          <span className="tabular-nums text-muted-foreground">{f.on(p.paper_on, "weekday").split(",")[0]}, {f.on(p.paper_on, "short")} · {clock12(p.starts_at)}</span>
        </li>))}</ul>
    </Card>))}</>;
}

function UpdateItem({ n }: { n: ParentFeedItem }) {
  const t = useT(), d = useData(), f = useFmt(), err = useErrText();
  const read = useReadUpdate();
  const school = n.scope === "school";
  return (
    <article className="flex gap-3" aria-label={t("upd.aria", { what: school ? t("upd.schoolNotice") : d(n.tag), who: n.sender_name })}>
      <Avatar name={n.sender_name} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-bold">{n.sender_name}</span>
          <Badge tone="neutral" className={school ? "bg-foreground text-background before:bg-background" : undefined}>{d(n.tag)}</Badge>
          <span className="ml-auto flex items-center gap-2 text-xs tabular-nums text-text-tertiary">{!n.is_read && <span className="inline-block size-2.5 rounded-full bg-danger"><span className="sr-only">{t("tag.unread")}</span></span>}{f.ist(n.created_at)}</span>
        </div>
        <p className={cn("text-sm", !n.is_read && "font-bold")}>{n.title}</p>
        <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{n.body}</p>
        {n.attachments.length > 0 && <div className="flex flex-wrap gap-1.5">{n.attachments.map((a) => <AttachmentChip key={a.id} a={a} />)}</div>}
        {!n.is_read && <Button size="sm" variant="ghost" className="-ml-3 w-fit" loading={read.isPending} onClick={() => read.mutate(n.id, { onError: (e) => toast.error(err(e)) })}>{t("pl.markRead")}</Button>}
      </div>
    </article>
  );
}

function Updates({ sid }: { sid: string }) {
  const t = useT(), d = useData(), err = useErrText();
  const q = useParentUpdates(sid);
  const all = useReadAllUpdates();
  const [filter, setFilter] = React.useState("all");
  return (
    <Card className="flex flex-col gap-4">
      {(q.data?.items.some((n) => !n.is_read)) && <Button size="sm" variant="secondary" className="self-end" loading={all.isPending} onClick={() => all.mutate(undefined, { onError: (e) => toast.error(err(e)) })}><CheckCheck /> {t("nf.markAll")}</Button>}
      <Loaded q={q}>
        {(page) => {
          const tags = [...new Set(page.items.map((n) => n.tag))].sort();
          const shown = filter === "all" ? page.items : page.items.filter((n) => n.tag === filter);
          return (<>
            {tags.length > 1 && (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={t("upd.filter")}>
                {["all", ...tags].map((v) => (
                  <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}
                    className={cn("h-8 shrink-0 rounded-full px-4 text-sm font-medium", filter === v ? "bg-foreground text-background" : "bg-fill text-muted-foreground hover:text-foreground")}>{v === "all" ? t("upd.all") : d(v)}</button>
                ))}
              </div>
            )}
            {shown.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{page.items.length ? t("upd.empty") : t("upd.none")}</p> : (
              <ul className="flex flex-col">{shown.map((n) => <li key={n.id} className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"><UpdateItem n={n} /></li>)}</ul>
            )}
          </>);
        }}
      </Loaded>
    </Card>
  );
}

function Calendar() {
  const t = useT(), d = useData(), f = useFmt();
  const today = useTodayIST();
  const q = useParentHolidays(today || undefined);
  return (
    <Card>
      <CardHeader><CardTitle>{t("nt.calendar")}</CardTitle></CardHeader>
      <Loaded q={q} loading={<p className="text-sm text-muted-foreground">{t("app.loading")}</p>}>
        {(rows) => rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("pl.noHolidays")}</p> : (
          <ul>{rows.map((h) => (
            <li key={h.id} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1"><p className="font-medium">{d(h.title)}</p><p className="text-xs tabular-nums text-muted-foreground">{f.on(h.from_on, "short")}{h.to_on !== h.from_on && ` – ${f.on(h.to_on, "short")}`}</p></div>
              {h.kind in KIND && <Badge tone={KIND[h.kind as keyof typeof KIND]}>{t(`kind.${h.kind as keyof typeof KIND}`)}</Badge>}
            </li>))}</ul>
        )}
      </Loaded>
    </Card>
  );
}

export function NoticesLive() {
  const t = useT();
  const sel = useChild();
  if (!sel) return null;
  return (
    <>
      <PageHeader title={t("nt.title")} />
      <DateSheets sid={sel.child.id} />
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-start">
        <Updates sid={sel.child.id} />
        <Calendar />
      </div>
    </>
  );
}
