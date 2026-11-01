"use client";
import * as React from "react";
import { BadgePercent, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSIGNMENTS, CONCESSIONS, HEADS, addConcession, assignConcession, concessionLabel, removeConcession, unassignConcession, useFeesStore,
  type Concession, type ConcessionKind,
} from "@/lib/fees-setup";
import { STUDENTS, className } from "@/lib/mock";
import { formatIST } from "@/lib/time";
import { ConfirmDialog } from "./confirm-dialog";

export function ConcessionsTab({ by }: { by: string }) {
  useFeesStore();
  const [del, setDel] = React.useState<Concession | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Definitions onDelete={setDel} />
        <AssignForm by={by} />
      </div>
      <Assigned />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title={`Delete ${del?.name ?? "concession"}?`} confirmLabel="Delete concession"
        description="Students who have it lose it from the next invoice run. Invoices already generated are not changed."
        onConfirm={() => { if (del) { removeConcession(del.id); toast.success(`Deleted ${del.name}`); } }} />
    </div>
  );
}

const countOf = (id: string) => { const n = ASSIGNMENTS.filter((a) => a.concessionId === id).length; return `${n} ${n === 1 ? "student" : "students"}`; };

function Definitions({ onDelete }: { onDelete: (c: Concession) => void }) {
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<ConcessionKind>("percent");
  const [value, setValue] = React.useState("");
  const [headId, setHeadId] = React.useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(value);
    const r = addConcession({ name, kind, value: kind === "percent" ? n : kind === "fixed" ? Math.round(n * 100) : 0, headId: headId || undefined });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`Added ${name.trim()}`); setName(""); setValue(""); setHeadId("");
  }
  return (
    <Card>
      <CardHeader><div><CardTitle>Concessions</CardTitle><CardDescription>Each becomes a negative line on the invoice.</CardDescription></div></CardHeader>
      {!CONCESSIONS.length ? <p className="text-sm text-muted-foreground">No concessions yet. Add one below.</p> : (
        <ul className="mb-5 flex flex-col">
          {CONCESSIONS.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
              <div className="min-w-0"><p className="font-medium">{c.name}</p><p className="text-xs text-text-tertiary">{concessionLabel(c)} · {countOf(c.id)}</p></div>
              <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => onDelete(c)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="cn-name"><Input id="cn-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Defence family" /></Field>
        <Field label="Type" htmlFor="cn-kind"><NativeSelect id="cn-kind" value={kind} onChange={(e) => setKind(e.target.value as ConcessionKind)}>
          <option value="percent">Percent off</option><option value="fixed">Fixed amount off</option><option value="waive_head">Waive a whole head</option></NativeSelect></Field>
        {kind !== "waive_head" && <Field label={kind === "percent" ? "Percent" : "Amount (₹)"} htmlFor="cn-value"><Input id="cn-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>}
        <Field label={kind === "waive_head" ? "Head to waive" : "Applies to"} htmlFor="cn-head">
          <NativeSelect id="cn-head" value={headId} onChange={(e) => setHeadId(e.target.value)}>
            {kind !== "waive_head" && <option value="">All heads</option>}{kind === "waive_head" && <option value="">Choose a head</option>}
            {HEADS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</NativeSelect></Field>
        <div className="sm:col-span-2"><Button type="submit" variant="secondary"><Plus /> Add concession</Button></div>
      </form>
    </Card>
  );
}

function AssignForm({ by }: { by: string }) {
  const [q, setQ] = React.useState("");
  const [studentId, setStudentId] = React.useState("");
  const [cid, setCid] = React.useState("");
  const [note, setNote] = React.useState("");
  const matches = q.trim().length >= 2 && !studentId ? STUDENTS.filter((s) => s.status === "active" && `${s.name} ${s.scholarNo}`.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  const chosen = STUDENTS.find((s) => s.id === studentId);
  function assign(e: React.FormEvent) {
    e.preventDefault();
    const r = assignConcession(studentId, cid, note, by);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success("Concession assigned", { description: "It applies from the next invoice run." });
    setQ(""); setStudentId(""); setCid(""); setNote("");
  }
  return (
    <Card>
      <CardHeader><div><CardTitle>Assign to a student</CardTitle><CardDescription>Approved by you and noted for the audit trail.</CardDescription></div></CardHeader>
      <form onSubmit={assign} className="flex flex-col gap-4">
        <Field label="Student" htmlFor="as-student">
          {chosen ? (
            <div className="flex h-10 items-center justify-between rounded-xl bg-fill pl-4 pr-1.5 text-sm"><span>{chosen.name} · Class {className(chosen.classId)}</span>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Clear student" onClick={() => { setStudentId(""); setQ(""); }}><X /></Button></div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
              <Input id="as-student" className="pl-10" placeholder="Search by name or scholar no." value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
              {q.trim().length >= 2 && (
                <ul className="mt-2 flex flex-col rounded-xl bg-fill p-1.5 text-sm" aria-label="Matching students">
                  {matches.length ? matches.map((s) => (
                    <li key={s.id}><button type="button" className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-separator" onClick={() => setStudentId(s.id)}>
                      <span>{s.name}</span><span className="text-xs text-text-tertiary">{s.scholarNo} · {className(s.classId)}</span></button></li>
                  )) : <li className="px-3 py-2 text-muted-foreground">No student found.</li>}
                </ul>
              )}
            </div>
          )}
        </Field>
        <Field label="Concession" htmlFor="as-concession"><NativeSelect id="as-concession" value={cid} onChange={(e) => setCid(e.target.value)}>
          <option value="">Choose a concession</option>{CONCESSIONS.map((c) => <option key={c.id} value={c.id}>{c.name} · {concessionLabel(c)}</option>)}</NativeSelect></Field>
        <Field label="Note" htmlFor="as-note" hint="Why it was approved. For example: sibling in class 8-B."><Textarea id="as-note" className="min-h-20" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div><Button type="submit" variant="brand">Assign concession</Button></div>
      </form>
    </Card>
  );
}

function Assigned() {
  if (!ASSIGNMENTS.length) return <EmptyState icon={BadgePercent} title="No concessions assigned" text="Search for a student above to give them a concession." />;
  return (
    <Card>
      <CardHeader><CardTitle>Students with concessions ({ASSIGNMENTS.length})</CardTitle></CardHeader>
      <ul className="flex flex-col">
        {ASSIGNMENTS.map((a) => {
          const s = STUDENTS.find((x) => x.id === a.studentId), c = CONCESSIONS.find((x) => x.id === a.concessionId);
          return (
            <li key={a.id} className="flex items-start justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">{s?.name ?? "Unknown student"} <span className="text-xs font-normal text-text-tertiary">Class {s ? className(s.classId) : "—"}</span><Badge tone="brand">{c?.name ?? "Removed"}</Badge></p>
                <p className="mt-0.5 text-sm text-muted-foreground">{a.note}</p>
                <p className="text-xs text-text-tertiary">Approved by {a.approvedBy} · {formatIST(a.at, "date")}</p>
              </div>
              <Button size="sm" variant="ghost" aria-label={`Remove concession from ${s?.name}`} onClick={() => { unassignConcession(a.id); toast.success("Concession removed"); }}>Remove</Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
