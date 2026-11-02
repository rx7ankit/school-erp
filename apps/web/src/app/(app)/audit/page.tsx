"use client";
import * as React from "react";
import { Search, ShieldAlert, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { StatCard } from "@/components/app/stat-card";
import { ExportButton } from "@/components/app/export-button";
import { Pager, usePaged } from "@/components/app/pager";
import { AuditDetail } from "@/components/app/audit/audit-detail";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan } from "@/components/app/can";
import { CATEGORY_LABEL, useAudit, type AuditCategory, type AuditEvent } from "@/lib/audit";
import { formatIST, todayOnIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";
import { cn } from "@/lib/utils";
import { isLive } from "@/lib/api/config";
import { AuditLive } from "@/components/app/audit-live";

const istDate = (utc: string) => todayOnIST(new Date(utc));
const CHIPS = [
  { id: "all", label: "Everything" }, { id: "today", label: "Today" }, { id: "week", label: "Last 7 days" },
  { id: "sensitive", label: "Sensitive only" }, { id: "money", label: "Money" }, { id: "signins", label: "Sign-ins" },
] as const;
type Chip = (typeof CHIPS)[number]["id"];

function AuditDemo() {
  const can = useCan();
  const events = useAudit();
  const today = useTodayIST();
  const [q, setQ] = React.useState("");
  const [chip, setChip] = React.useState<Chip>("all");
  const [category, setCategory] = React.useState("all");
  const [person, setPerson] = React.useState("all");
  const [action, setAction] = React.useState("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [open, setOpen] = React.useState<AuditEvent | null>(null);

  const weekAgo = React.useMemo(() => { if (!today) return ""; const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 6); return d.toISOString().slice(0, 10); }, [today]);
  const people = React.useMemo(() => [...new Set(events.map((e) => e.actorName))].sort(), [events]);
  const actions = React.useMemo(() => [...new Set(events.map((e) => e.action))].sort(), [events]);

  const shown = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      const day = istDate(e.at);
      if (chip === "today" && day !== today) return false;
      if (chip === "week" && day < weekAgo) return false;
      if (chip === "sensitive" && !e.sensitive) return false;
      if (chip === "money" && e.category !== "fees") return false;
      if (chip === "signins" && e.category !== "security") return false;
      if (category !== "all" && e.category !== category) return false;
      if (person !== "all" && e.actorName !== person) return false;
      if (action !== "all" && e.action !== action) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      return !needle || `${e.summary} ${e.actorName} ${e.entity ?? ""} ${e.action}`.toLowerCase().includes(needle);
    });
  }, [events, q, chip, category, person, action, from, to, today, weekAgo]);
  const paged = usePaged(shown, 20);
  const filtered = q || chip !== "all" || category !== "all" || person !== "all" || action !== "all" || from || to;
  const clear = () => { setQ(""); setChip("all"); setCategory("all"); setPerson("all"); setAction("all"); setFrom(""); setTo(""); };

  if (!can("admin")) return <NoAccess need="admin access" />;
  const last7 = events.filter((e) => istDate(e.at) >= weekAgo);
  const stats = {
    today: events.filter((e) => istDate(e.at) === today).length,
    sensitive: last7.filter((e) => e.sensitive).length,
    people: new Set(last7.map((e) => e.actorName)).size,
    failed: last7.filter((e) => e.action === "login.failed").length,
  };

  return (
    <>
      <PageHeader eyebrow="Admin only" title="Audit log." dim="Everything that happens, in one place."
        actions={<ExportButton fileName="audit-log" build={() => [{ name: "Audit log", headers: ["Time (IST)", "Who", "Role", "Category", "Action", "What happened", "About", "Sensitive", "Changes"],
          rows: shown.map((e) => [formatIST(e.at), e.actorName, e.actorRole, CATEGORY_LABEL[e.category], e.action, e.summary, e.entity ?? "", e.sensitive ? "Yes" : "", (e.changes ?? []).map((c) => `${c.field}: ${c.from} → ${c.to}`).join("; ")]) }]} />} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Events today" value={stats.today} />
        <StatCard label="Sensitive, 7 days" value={stats.sensitive} hint="Money, access, leaving" />
        <StatCard label="People active" value={stats.people} hint="Last 7 days" />
        <StatCard label="Failed sign-ins" value={stats.failed} hint="Last 7 days" />
      </div>

      <Card className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input aria-label="Search the audit log" className="rounded-full pl-10" placeholder="Search a person, student, invoice, or what happened" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick filters">
          {CHIPS.map((c) => (
            <button key={c.id} type="button" aria-pressed={chip === c.id} onClick={() => setChip(c.id)}
              className={cn("h-8 rounded-full bg-fill px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground", chip === c.id && "bg-brand text-brand-foreground hover:text-brand-foreground")}>{c.label}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <NativeSelect aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {(Object.keys(CATEGORY_LABEL) as AuditCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="all">Everyone</option>{people.map((p) => <option key={p}>{p}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="all">All actions</option>{actions.map((a) => <option key={a}>{a}</option>)}
          </NativeSelect>
          <Input aria-label="From date" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <Input aria-label="To date" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span aria-live="polite" className="tabular-nums">{shown.length} {shown.length === 1 ? "event" : "events"}{filtered ? " match" : ""}</span>
          {filtered && <Button variant="ghost" size="sm" onClick={clear}><X /> Clear filters</Button>}
        </div>
      </Card>

      <Card>
        <Table className="min-w-[860px]">
          <TableHeader><TableRow><TableHead className="w-44">Time (IST)</TableHead><TableHead className="w-56">Who</TableHead><TableHead className="w-40">Category</TableHead><TableHead>What happened</TableHead></TableRow></TableHeader>
          <TableBody>
            {paged.rows.map((e) => (
              <TableRow key={e.id} className="cursor-pointer" onClick={() => setOpen(e)}>
                <TableCell className="align-top tabular-nums text-muted-foreground">{formatIST(e.at)}</TableCell>
                <TableCell className="align-top"><div className="flex items-center gap-2.5"><Avatar name={e.actorName} className="size-8 text-[11px]" /><div className="min-w-0"><p className="truncate font-medium">{e.actorName}</p><p className="truncate text-xs text-text-tertiary">{e.actorRole}</p></div></div></TableCell>
                <TableCell className="align-top"><Badge>{CATEGORY_LABEL[e.category]}</Badge></TableCell>
                <TableCell className="align-top">
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); setOpen(e); }} className="flex w-full items-start gap-2 text-left">
                    {e.sensitive && <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Sensitive" />}
                    <span>{e.summary}{e.changes?.length ? <span className="ml-2 text-xs text-brand">{e.changes.length} {e.changes.length === 1 ? "change" : "changes"}</span> : null}</span>
                  </button>
                </TableCell>
              </TableRow>
            ))}
            {shown.length === 0 && <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">Nothing matches. Try fewer filters.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <Pager {...paged} />
      </Card>
      <AuditDetail event={open} onClose={() => setOpen(null)} />
    </>
  );
}

export default function AuditPage() {
  const can = useCan();
  if (!isLive) return <AuditDemo />;
  if (!can("admin")) return <NoAccess need="admin access" />;
  return <AuditLive />;
}
