"use client";
import * as React from "react";
import { Search, ShieldAlert, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Pager } from "@/components/app/pager";
import { AuditDetail } from "@/components/app/audit/audit-detail";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditLog, useAuditOptions } from "@/lib/api/hooks/audit";
import { errorText } from "@/lib/api/hooks/staff";
import type { AuditOut } from "@/lib/api/types";
import { CATEGORY_LABEL, type AuditCategory, type AuditEvent } from "@/lib/audit";
import { formatIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const SIZE = 25;
const CHIPS = [
  { id: "all", label: "All" }, { id: "today", label: "Today" }, { id: "week", label: "7 days" },
  { id: "sensitive", label: "Sensitive" }, { id: "money", label: "Money" }, { id: "signins", label: "Sign-ins" },
] as const;
type Chip = (typeof CHIPS)[number]["id"];

const label = (c: string) => CATEGORY_LABEL[c as AuditCategory] ?? c;

/** The API row as the shape AuditDetail already shows. Only what the API sends. */
function toEvent(a: AuditOut): AuditEvent {
  const changes = (Array.isArray(a.changes) ? a.changes : []).filter((c): c is { field: string; from: string; to: string } => !!c && typeof c === "object" && "field" in c)
    .map((c) => ({ field: String(c.field), from: String(c.from ?? ""), to: String(c.to ?? "") }));
  return { id: a.id, at: a.at, actorName: a.actor_name, actorRole: a.actor_role, category: a.category as AuditCategory, action: a.action, summary: a.summary, entity: a.entity_label ?? undefined, sensitive: a.sensitive, changes: changes.length ? changes : undefined };
}

/** Audit log on the real API (admin only; the page checks first). Filtering and paging happen on the server. */
export function AuditLive() {
  const today = useTodayIST();
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [chip, setChip] = React.useState<Chip>("all");
  const [category, setCategory] = React.useState("all");
  const [person, setPerson] = React.useState("all");
  const [action, setAction] = React.useState("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [open, setOpen] = React.useState<AuditEvent | null>(null);

  React.useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const weekAgo = React.useMemo(() => { if (!today) return ""; const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 6); return d.toISOString().slice(0, 10); }, [today]);
  // Quick chips narrow the same filters the dropdowns use; an explicit choice in a field wins.
  const eff = {
    category: category !== "all" ? category : chip === "money" ? "fees" : chip === "signins" ? "security" : undefined,
    sensitive: chip === "sensitive" ? true : undefined,
    date_from: from || (chip === "today" ? today : chip === "week" ? weekAgo : "") || undefined,
    date_to: to || (chip === "today" ? today : "") || undefined,
  };
  const log = useAuditLog({ q: q.trim() || undefined, category: eff.category, actor: person !== "all" ? person : undefined, action: action !== "all" ? action : undefined, sensitive: eff.sensitive, date_from: eff.date_from, date_to: eff.date_to, limit: SIZE, offset: page * SIZE });
  const options = useAuditOptions();
  const rows = React.useMemo(() => (log.data?.items ?? []).map(toEvent), [log.data]);
  const total = log.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / SIZE));

  const filtered = q || chip !== "all" || category !== "all" || person !== "all" || action !== "all" || from || to;
  const reset = (fn: () => void) => { fn(); setPage(0); };
  const clear = () => { setSearch(""); setQ(""); setChip("all"); setCategory("all"); setPerson("all"); setAction("all"); setFrom(""); setTo(""); setPage(0); };

  return (
    <>
      <PageHeader title="Audit log" />

      <Card className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input aria-label="Search the audit log" className="rounded-full pl-10" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick filters">
          {CHIPS.map((c) => (
            <button key={c.id} type="button" aria-pressed={chip === c.id} onClick={() => reset(() => setChip(c.id))}
              className={cn("h-8 cursor-pointer rounded-full bg-fill px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground", chip === c.id && "bg-brand text-brand-foreground hover:text-brand-foreground")}>{c.label}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <NativeSelect aria-label="Category" value={category} onChange={(e) => reset(() => setCategory(e.target.value))}>
            <option value="all">Category</option>
            {(Object.keys(CATEGORY_LABEL) as AuditCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Person" value={person} onChange={(e) => reset(() => setPerson(e.target.value))}>
            <option value="all">Person</option>{(options.data?.actors ?? []).map((p) => <option key={p}>{p}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Action" value={action} onChange={(e) => reset(() => setAction(e.target.value))}>
            <option value="all">Action</option>{(options.data?.actions ?? []).map((a) => <option key={a}>{a}</option>)}
          </NativeSelect>
          <Input aria-label="From date" type="date" value={from} max={to || undefined} onChange={(e) => reset(() => setFrom(e.target.value))} />
          <Input aria-label="To date" type="date" value={to} min={from || undefined} onChange={(e) => reset(() => setTo(e.target.value))} />
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span aria-live="polite" className="tabular-nums">{log.isPending ? "Loading…" : `${total} ${total === 1 ? "event" : "events"}`}</span>
          {filtered && <Button variant="ghost" size="sm" onClick={clear}><X /> Clear</Button>}
        </div>
      </Card>

      <Card>
        {log.isError ? (
          <div className="flex flex-col items-start gap-3 py-6"><p role="alert" className="text-sm text-danger">{errorText(log.error)}</p><Button variant="secondary" size="sm" onClick={() => log.refetch()}>Retry</Button></div>
        ) : (
          <>
            <Table className={cn("min-w-[860px]", log.isPlaceholderData && "opacity-60")}>
              <TableHeader><TableRow><TableHead className="w-44">Time</TableHead><TableHead className="w-56">Who</TableHead><TableHead className="w-40">Type</TableHead><TableHead>Event</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="align-top tabular-nums text-muted-foreground">{formatIST(e.at)}</TableCell>
                    <TableCell className="align-top"><div className="flex items-center gap-2.5"><Avatar name={e.actorName} className="size-8 text-[11px]" /><div className="min-w-0"><p className="truncate font-medium">{e.actorName}</p><p className="truncate text-xs text-text-tertiary">{e.actorRole}</p></div></div></TableCell>
                    <TableCell className="align-top"><Badge>{label(e.category)}</Badge></TableCell>
                    <TableCell className="align-top">
                      <button type="button" onClick={() => setOpen(e)} className="flex w-full cursor-pointer items-start gap-2 text-left">
                        {e.sensitive && <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Sensitive" />}
                        <span>{e.summary}{e.changes?.length ? <span className="ml-2 text-xs text-brand">{e.changes.length} {e.changes.length === 1 ? "change" : "changes"}</span> : null}</span>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {log.isSuccess && rows.length === 0 && <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">No events.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <Pager page={Math.min(page, pages - 1)} pages={pages} total={total} size={SIZE} setPage={setPage} />
          </>
        )}
      </Card>
      <AuditDetail event={open} onClose={() => setOpen(null)} />
    </>
  );
}
