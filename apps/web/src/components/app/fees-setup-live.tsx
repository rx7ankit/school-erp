"use client";
import * as React from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Problem, useDebounced } from "@/components/app/bits-a3";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClasses } from "@/lib/api/hooks/academic";
import {
  FREQUENCY_LABEL, useAddConcession, useAddHead, useAddRoute, useAssignConcession, useConcessions, useCopyStructure, useDeleteStructure, useEditConcession, useEditHead, useEditRoute,
  useHeads, useRemoveOption, useRevokeConcession, useRoutes, useSetOption, useSetStructure, useStructures, useStudentConcessions, useStudentOptions, useStudentSearch,
  type FeeFrequency, type StudentHit,
} from "@/lib/api/hooks/fees";
import { inr, parseRupees, rupeesText } from "@/lib/money";

const FREQS = Object.keys(FREQUENCY_LABEL) as FeeFrequency[];
const classLabel = (c: { grade: string; section: string }) => `Class ${c.grade}-${c.section}`;

/** Search by name or scholar number, then pick one student. */
export function StudentPicker({ value, onChange }: { value: StudentHit | null; onChange: (s: StudentHit | null) => void }) {
  const [text, setText] = React.useState("");
  const q = useDebounced(text);
  const hits = useStudentSearch(q);
  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-fill px-4 py-2.5 text-sm">
        <span><b>{value.name}</b> <span className="text-text-tertiary">{value.class_label ? `Class ${value.class_label} · ` : ""}{value.scholar_no}</span></span>
        <Button size="icon-sm" variant="ghost" aria-label="Choose another student" onClick={() => onChange(null)}><X /></Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
        <Input aria-label="Find a student" className="rounded-full pl-10" placeholder="Type a name or scholar number" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {q.trim().length >= 2 && (
        hits.isPending ? <p className="px-2 text-sm text-muted-foreground">Searching…</p> :
        hits.isError ? <Problem error={hits.error} /> :
        hits.data!.items.length === 0 ? <p className="px-2 text-sm text-muted-foreground">No student found.</p> : (
          <ul className="overflow-hidden rounded-xl bg-fill">
            {hits.data!.items.map((s) => (
              <li key={s.id}><button type="button" className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-separator" onClick={() => onChange(s)}>
                <span className="font-medium">{s.name}</span><span className="text-xs text-text-tertiary">{s.class_label ? `Class ${s.class_label} · ` : ""}{s.scholar_no}</span>
              </button></li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) { return <TableHeader><TableRow>{children}</TableRow></TableHeader>; }

/* ------------------------------------------------------------------ fee heads */
export function HeadsTab() {
  const heads = useHeads(), add = useAddHead(), edit = useEditHead();
  const [name, setName] = React.useState("");
  const [scope, setScope] = React.useState<"class" | "optional">("class");
  const [err, setErr] = React.useState<unknown>(null);
  const [ren, setRen] = React.useState<{ id: string; name: string } | null>(null);
  if (heads.isError) return <ErrorBlock error={heads.error} onRetry={() => heads.refetch()} />;
  if (!heads.data) return <LoadingBlock label="Loading fee heads" />;
  return (
    <Card className="flex flex-col gap-5">
      <CardHeader className="mb-0"><div><CardTitle>Fee heads</CardTitle><CardDescription>Class heads (tuition, exam fee) go in every class&apos;s fees. Optional heads (transport) are taken student by student.</CardDescription></div></CardHeader>
      <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto]" onSubmit={(e) => {
        e.preventDefault(); setErr(null);
        add.mutate({ name: name.trim(), scope }, { onSuccess: () => { toast.success("Fee head added"); setName(""); }, onError: setErr });
      }}>
        <Input aria-label="New fee head" placeholder="For example: Tuition fee" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <NativeSelect aria-label="Kind of head" value={scope} onChange={(e) => setScope(e.target.value as "class" | "optional")}><option value="class">Class fee</option><option value="optional">Optional fee</option></NativeSelect>
        <Button type="submit" variant="brand" loading={add.isPending} disabled={!name.trim()}><Plus /> Add head</Button>
      </form>
      <Problem error={err} />
      <Table>
        <Head><TableHead>Name</TableHead><TableHead>Kind</TableHead><TableHead className="text-right">Active</TableHead><TableHead className="text-right"><span className="sr-only">Rename</span></TableHead></Head>
        <TableBody>
          {heads.data.map((h) => (
            <TableRow key={h.id}>
              <TableCell className="font-medium">{h.name}</TableCell>
              <TableCell><Badge>{h.scope === "optional" ? "Optional" : "Class fee"}</Badge></TableCell>
              <TableCell className="text-right"><Switch aria-label={`${h.name} active`} checked={h.is_active} disabled={edit.isPending} onCheckedChange={(v) => edit.mutate({ id: h.id, is_active: v }, { onError: (e) => toast.error(e.message) })} /></TableCell>
              <TableCell className="text-right"><Button size="icon-sm" variant="ghost" aria-label={`Rename ${h.name}`} onClick={() => setRen({ id: h.id, name: h.name })}><Pencil /></Button></TableCell>
            </TableRow>
          ))}
          {heads.data.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No fee heads yet. Add Tuition fee first.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <RenameDialog value={ren} onClose={() => setRen(null)} title="Rename fee head" pending={edit.isPending} onSave={(id, n, fail) => edit.mutate({ id, name: n }, { onSuccess: () => setRen(null), onError: fail })} />
    </Card>
  );
}

function RenameDialog({ value, onClose, title, pending, onSave }: { value: { id: string; name: string } | null; onClose: () => void; title: string; pending: boolean; onSave: (id: string, name: string, fail: (e: unknown) => void) => void }) {
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{value && <RenameBody key={value.id} {...{ value, onClose, title, pending, onSave }} />}</DialogContent>
    </Dialog>
  );
}
function RenameBody({ value, onClose, title, pending, onSave }: { value: { id: string; name: string }; onClose: () => void; title: string; pending: boolean; onSave: (id: string, name: string, fail: (e: unknown) => void) => void }) {
  const [name, setName] = React.useState(value.name);
  const [err, setErr] = React.useState<unknown>(null);
  return (
    <>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <Field label="Name" htmlFor="ren"><Input id="ren" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
      <Problem error={err} />
      <DialogFooter><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="brand" loading={pending} disabled={!name.trim()} onClick={() => onSave(value.id, name.trim(), setErr)}>Save</Button></DialogFooter>
    </>
  );
}

/* ------------------------------------------------------------------ fees per class */
export function ClassFeesTab() {
  const classes = useClasses(), heads = useHeads();
  const [classId, setClassId] = React.useState("");
  const cid = classId || classes.data?.items[0]?.id || "";
  const rows = useStructures(cid || undefined);
  const set = useSetStructure(), del = useDeleteStructure(), copy = useCopyStructure();
  const [headId, setHeadId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [freq, setFreq] = React.useState<FeeFrequency>("monthly");
  const [from, setFrom] = React.useState("");
  const [err, setErr] = React.useState<unknown>(null);
  if (classes.isError) return <ErrorBlock error={classes.error} onRetry={() => classes.refetch()} />;
  if (heads.isError) return <ErrorBlock error={heads.error} onRetry={() => heads.refetch()} />;
  if (!classes.data || !heads.data) return <LoadingBlock label="Loading classes" />;
  if (!classes.data.items.length) return <Card className="py-10 text-center text-muted-foreground">Add classes in Academic first.</Card>;
  const classHeads = heads.data.filter((h) => h.scope === "class" && h.is_active);
  const paise = parseRupees(amount);
  const others = classes.data.items.filter((c) => c.id !== cid);
  const total = (rows.data ?? []).reduce((s, r) => s + r.amount_paise, 0);
  return (
    <Card className="flex flex-col gap-5">
      <CardHeader className="mb-0"><div><CardTitle>Fees per class</CardTitle><CardDescription>What every student of the class pays. Changing a line affects invoices generated from now on, not the ones already sent.</CardDescription></div>
        <NativeSelect aria-label="Class" className="w-44" value={cid} onChange={(e) => { setClassId(e.target.value); setErr(null); }}>{classes.data.items.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</NativeSelect></CardHeader>
      {rows.isError ? <ErrorBlock error={rows.error} onRetry={() => rows.refetch()} /> : !rows.data ? <LoadingBlock label="Loading fees" /> : (
        <Table>
          <Head><TableHead>Fee head</TableHead><TableHead>How often</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right"><span className="sr-only">Remove</span></TableHead></Head>
          <TableBody>
            {rows.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.head_name}</TableCell><TableCell>{FREQUENCY_LABEL[r.frequency] ?? r.frequency}</TableCell>
                <TableCell className="text-right tabular-nums">{inr(r.amount_paise)}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.head_name}`} onClick={() => { setHeadId(r.fee_head_id); setAmount(rupeesText(r.amount_paise)); setFreq(r.frequency as FeeFrequency); }}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${r.head_name}`} disabled={del.isPending} onClick={() => del.mutate(r.id, { onSuccess: () => toast.success("Fee line removed"), onError: (e) => toast.error(e.message) })}><Trash2 /></Button>
                </div></TableCell>
              </TableRow>
            ))}
            {rows.data.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No fees set for this class yet.</TableCell></TableRow>}
            {rows.data.length > 0 && <TableRow><TableCell colSpan={2} className="font-bold">Sum of lines</TableCell><TableCell className="text-right font-bold tabular-nums">{inr(total)}</TableCell><TableCell /></TableRow>}
          </TableBody>
        </Table>
      )}
      <form className="grid gap-3 sm:grid-cols-[1fr_140px_150px_auto]" onSubmit={(e) => {
        e.preventDefault(); setErr(null);
        if (paise === null || !headId) return;
        set.mutate({ class_id: cid, fee_head_id: headId, amount_paise: paise, frequency: freq }, { onSuccess: () => { toast.success("Fee saved"); setAmount(""); setHeadId(""); }, onError: setErr });
      }}>
        <NativeSelect aria-label="Fee head" value={headId} onChange={(e) => setHeadId(e.target.value)}><option value="">Choose a fee head</option>{classHeads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</NativeSelect>
        <Input aria-label="Amount in rupees" inputMode="decimal" placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <NativeSelect aria-label="How often" value={freq} onChange={(e) => setFreq(e.target.value as FeeFrequency)}>{FREQS.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}</NativeSelect>
        <Button type="submit" variant="brand" loading={set.isPending} disabled={paise === null || !headId}>Save line</Button>
      </form>
      <Problem error={err} />
      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <span className="text-sm text-muted-foreground">Copy every fee line into {classLabel(classes.data.items.find((c) => c.id === cid)!)} from</span>
          <NativeSelect aria-label="Copy from class" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)}><option value="">Choose a class</option>{others.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</NativeSelect>
          <Button variant="secondary" loading={copy.isPending} disabled={!from} onClick={() => copy.mutate({ from_class_id: from, to_class_id: cid }, { onSuccess: (r) => { toast.success(`${r.copied} fee ${r.copied === 1 ? "line" : "lines"} copied`); setFrom(""); }, onError: (e) => toast.error(e.message) })}>Copy fees</Button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ transport and optional fees */
export function TransportTab() {
  const routes = useRoutes(), add = useAddRoute(), edit = useEditRoute();
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [err, setErr] = React.useState<unknown>(null);
  const [editing, setEditing] = React.useState<{ id: string; name: string; amount: string } | null>(null);
  const paise = parseRupees(amount);
  if (routes.isError) return <ErrorBlock error={routes.error} onRetry={() => routes.refetch()} />;
  if (!routes.data) return <LoadingBlock label="Loading routes" />;
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5">
        <CardHeader className="mb-0"><div><CardTitle>Transport routes</CardTitle><CardDescription>A route has one price. Students are put on a route below.</CardDescription></div></CardHeader>
        <form className="grid gap-3 sm:grid-cols-[1fr_160px_auto]" onSubmit={(e) => {
          e.preventDefault(); setErr(null);
          if (paise === null) return;
          add.mutate({ name: name.trim(), amount_paise: paise }, { onSuccess: () => { toast.success("Route added"); setName(""); setAmount(""); }, onError: setErr });
        }}>
          <Input aria-label="Route name" placeholder="For example: Route 1, City Centre" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          <Input aria-label="Price in rupees" inputMode="decimal" placeholder="Price (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button type="submit" variant="brand" loading={add.isPending} disabled={!name.trim() || paise === null}><Plus /> Add route</Button>
        </form>
        <Problem error={err} />
        <Table>
          <Head><TableHead>Route</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Active</TableHead><TableHead className="text-right"><span className="sr-only">Edit</span></TableHead></Head>
          <TableBody>
            {routes.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell><TableCell className="text-right tabular-nums">{inr(r.amount_paise)}</TableCell>
                <TableCell className="text-right"><Switch aria-label={`${r.name} active`} checked={r.is_active} disabled={edit.isPending} onCheckedChange={(v) => edit.mutate({ id: r.id, is_active: v }, { onError: (e) => toast.error(e.message) })} /></TableCell>
                <TableCell className="text-right"><Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => setEditing({ id: r.id, name: r.name, amount: rupeesText(r.amount_paise) })}><Pencil /></Button></TableCell>
              </TableRow>
            ))}
            {routes.data.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No routes yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <StudentOptions />
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>{editing && <RouteEdit key={editing.id} route={editing} onClose={() => setEditing(null)} />}</DialogContent>
      </Dialog>
    </div>
  );
}
function RouteEdit({ route, onClose }: { route: { id: string; name: string; amount: string }; onClose: () => void }) {
  const edit = useEditRoute();
  const [name, setName] = React.useState(route.name);
  const [amount, setAmount] = React.useState(route.amount);
  const [err, setErr] = React.useState<unknown>(null);
  const paise = parseRupees(amount);
  return (
    <>
      <DialogHeader><DialogTitle>Edit route</DialogTitle><DialogDescription>A new price applies to invoices generated from now on.</DialogDescription></DialogHeader>
      <Field label="Route name" htmlFor="rn"><Input id="rn" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Price (₹)" htmlFor="rp"><Input id="rp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Problem error={err} />
      <DialogFooter><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="brand" loading={edit.isPending} disabled={!name.trim() || paise === null} onClick={() => paise !== null && edit.mutate({ id: route.id, name: name.trim(), amount_paise: paise }, { onSuccess: () => { toast.success("Route saved"); onClose(); }, onError: setErr })}>Save</Button></DialogFooter>
    </>
  );
}

function StudentOptions() {
  const [student, setStudent] = React.useState<StudentHit | null>(null);
  const opts = useStudentOptions(student?.id ?? null);
  const heads = useHeads(), routes = useRoutes();
  const set = useSetOption(), remove = useRemoveOption();
  const [headId, setHeadId] = React.useState("");
  const [routeId, setRouteId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [freq, setFreq] = React.useState<FeeFrequency>("monthly");
  const [err, setErr] = React.useState<unknown>(null);
  const optional = (heads.data ?? []).filter((h) => h.scope === "optional" && h.is_active);
  const paise = amount.trim() ? parseRupees(amount) : null;
  const badAmount = amount.trim() !== "" && paise === null;
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0"><div><CardTitle>Optional fees for a student</CardTitle><CardDescription>Put a student on a transport route or another optional fee. Only invoices not yet generated change.</CardDescription></div></CardHeader>
      <StudentPicker value={student} onChange={(s) => { setStudent(s); setErr(null); }} />
      {student && (
        <>
          {opts.isError ? <ErrorBlock error={opts.error} onRetry={() => opts.refetch()} /> : !opts.data ? <LoadingBlock label="Loading" /> : (
            <ul className="flex flex-col gap-2">
              {opts.data.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 rounded-xl bg-fill px-4 py-3 text-sm">
                  <span><b>{o.head_name}</b>{o.route_name ? ` · ${o.route_name}` : ""} · {inr(o.amount_paise)} {FREQUENCY_LABEL[o.frequency]?.toLowerCase()}{o.note && <span className="text-text-tertiary"> · {o.note}</span>}</span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${o.head_name}`} disabled={remove.isPending} onClick={() => remove.mutate({ studentId: student.id, optionId: o.id }, { onSuccess: () => toast.success("Removed"), onError: (e) => toast.error(e.message) })}><Trash2 /></Button>
                </li>
              ))}
              {opts.data.length === 0 && <li className="text-sm text-muted-foreground">No optional fees for this student.</li>}
            </ul>
          )}
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_130px_140px_auto]" onSubmit={(e) => {
            e.preventDefault(); setErr(null);
            set.mutate({ studentId: student.id, fee_head_id: headId, route_id: routeId || null, amount_paise: paise, frequency: freq }, { onSuccess: () => { toast.success("Saved"); setAmount(""); }, onError: setErr });
          }}>
            <NativeSelect aria-label="Optional fee head" value={headId} onChange={(e) => setHeadId(e.target.value)}><option value="">Fee head</option>{optional.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</NativeSelect>
            <NativeSelect aria-label="Route" value={routeId} onChange={(e) => setRouteId(e.target.value)}><option value="">No route</option>{(routes.data ?? []).filter((r) => r.is_active).map((r) => <option key={r.id} value={r.id}>{r.name} · {inr(r.amount_paise)}</option>)}</NativeSelect>
            <Input aria-label="Amount, if not the route price" inputMode="decimal" placeholder={routeId ? "Route price" : "Amount (₹)"} aria-invalid={badAmount} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <NativeSelect aria-label="How often" value={freq} onChange={(e) => setFreq(e.target.value as FeeFrequency)}>{FREQS.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}</NativeSelect>
            <Button type="submit" variant="brand" loading={set.isPending} disabled={!headId || badAmount || (!routeId && paise === null)}>Save</Button>
          </form>
          {optional.length === 0 && <p className="text-sm text-muted-foreground">Add a head of kind &ldquo;Optional&rdquo; (for example Transport) in the Fee heads tab first.</p>}
          <Problem error={err} />
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ concessions */
export function ConcessionsTab() {
  const list = useConcessions(), heads = useHeads(), add = useAddConcession(), edit = useEditConcession();
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<"percent" | "fixed">("percent");
  const [value, setValue] = React.useState("");
  const [headId, setHeadId] = React.useState("");
  const [err, setErr] = React.useState<unknown>(null);
  const v = kind === "percent" ? (/^\d{1,3}$/.test(value) ? Number(value) : null) : parseRupees(value);
  const bad = v === null || v <= 0 || (kind === "percent" && v > 100);
  if (list.isError) return <ErrorBlock error={list.error} onRetry={() => list.refetch()} />;
  if (!list.data) return <LoadingBlock label="Loading concessions" />;
  const headName = (id: string | null) => (id ? heads.data?.find((h) => h.id === id)?.name ?? "One head" : "Whole invoice");
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5">
        <CardHeader className="mb-0"><div><CardTitle>Concessions</CardTitle><CardDescription>A discount a student can be given for the year. It appears as a minus line on invoices generated from then on.</CardDescription></div></CardHeader>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_130px_130px_1fr_auto]" onSubmit={(e) => {
          e.preventDefault(); setErr(null);
          if (bad || v === null) return;
          add.mutate({ name: name.trim(), kind, value: v, fee_head_id: headId || null }, { onSuccess: () => { toast.success("Concession added"); setName(""); setValue(""); }, onError: setErr });
        }}>
          <Input aria-label="Concession name" placeholder="For example: Sibling discount" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          <NativeSelect aria-label="Kind" value={kind} onChange={(e) => { setKind(e.target.value as "percent" | "fixed"); setValue(""); }}><option value="percent">Percent</option><option value="fixed">Fixed ₹</option></NativeSelect>
          <Input aria-label={kind === "percent" ? "Percent off" : "Rupees off"} inputMode="decimal" placeholder={kind === "percent" ? "% off" : "₹ off"} value={value} onChange={(e) => setValue(e.target.value)} />
          <NativeSelect aria-label="Applies to" value={headId} onChange={(e) => setHeadId(e.target.value)}><option value="">Whole invoice</option>{(heads.data ?? []).map((h) => <option key={h.id} value={h.id}>{h.name} only</option>)}</NativeSelect>
          <Button type="submit" variant="brand" loading={add.isPending} disabled={!name.trim() || bad}><Plus /> Add</Button>
        </form>
        <Problem error={err} />
        <Table>
          <Head><TableHead>Name</TableHead><TableHead>Discount</TableHead><TableHead>Applies to</TableHead><TableHead className="text-right">Active</TableHead></Head>
          <TableBody>
            {list.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell><TableCell className="tabular-nums">{c.kind === "percent" ? `${c.value}%` : inr(c.value)}</TableCell><TableCell>{headName(c.fee_head_id)}</TableCell>
                <TableCell className="text-right"><Switch aria-label={`${c.name} active`} checked={c.is_active} disabled={edit.isPending} onCheckedChange={(x) => edit.mutate({ id: c.id, is_active: x }, { onError: (e) => toast.error(e.message) })} /></TableCell>
              </TableRow>
            ))}
            {list.data.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No concessions yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <GiveConcession />
    </div>
  );
}
function GiveConcession() {
  const [student, setStudent] = React.useState<StudentHit | null>(null);
  const mine = useStudentConcessions(student?.id ?? null);
  const all = useConcessions();
  const give = useAssignConcession(), revoke = useRevokeConcession();
  const [cid, setCid] = React.useState("");
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<unknown>(null);
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0"><div><CardTitle>Give a concession to a student</CardTitle><CardDescription>For the current academic year. Invoices already generated do not change.</CardDescription></div></CardHeader>
      <StudentPicker value={student} onChange={(s) => { setStudent(s); setErr(null); }} />
      {student && (
        <>
          {mine.isError ? <ErrorBlock error={mine.error} onRetry={() => mine.refetch()} /> : !mine.data ? <LoadingBlock label="Loading" /> : (
            <ul className="flex flex-col gap-2">
              {mine.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-fill px-4 py-3 text-sm">
                  <span><b>{c.concession_name}</b> · {c.kind === "percent" ? `${c.value}%` : inr(c.value)}{c.approved_by_name && <span className="text-text-tertiary"> · by {c.approved_by_name}</span>}{c.note && <span className="text-text-tertiary"> · {c.note}</span>}</span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Revoke ${c.concession_name}`} disabled={revoke.isPending} onClick={() => revoke.mutate({ studentId: student.id, rowId: c.id }, { onSuccess: () => toast.success("Concession revoked"), onError: (e) => toast.error(e.message) })}><Trash2 /></Button>
                </li>
              ))}
              {mine.data.length === 0 && <li className="text-sm text-muted-foreground">No concessions for this student.</li>}
            </ul>
          )}
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => {
            e.preventDefault(); setErr(null);
            give.mutate({ studentId: student.id, concession_id: cid, note: note.trim() || null }, { onSuccess: () => { toast.success("Concession given"); setCid(""); setNote(""); }, onError: setErr });
          }}>
            <NativeSelect aria-label="Concession" value={cid} onChange={(e) => setCid(e.target.value)}><option value="">Choose a concession</option>{(all.data ?? []).filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
            <Input aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            <Button type="submit" variant="brand" loading={give.isPending} disabled={!cid}>Give</Button>
          </form>
          <Problem error={err} />
        </>
      )}
    </Card>
  );
}
