"use client";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiError } from "@/lib/api/client";
import { useAddBook, useBook, useCopyLookup, useEditBook, useIssue, useLibrarySettings, useReturn, useSaveSettings, useStaffSearch, useStudentSearch } from "@/lib/api/hooks/library";
import type { BookOut, LoanOut } from "@/lib/api/types";
import { formatDateOn, formatINR, todayOnIST } from "@/lib/time";

export const msg = (e: unknown) => (e instanceof ApiError ? [e.message, ...Object.values(e.fields)].join(" ") : "Something went wrong. Please try again.");
const Alert = ({ error }: { error: unknown }) => (error ? <p role="alert" className="text-sm text-destructive">{msg(error)}</p> : null);
const FieldErr = ({ error, name }: { error: unknown; name: string }) => (error instanceof ApiError && error.fields[name] ? <p className="text-xs text-destructive">{error.fields[name]}</p> : null);

/** Dialog that mounts its form only while open, so every opening starts fresh. */
function Modal({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>{open && children}</DialogContent></Dialog>;
}

/* ---------- add / edit a book ---------- */
export function BookDialog({ book, open, onOpenChange }: { book: BookOut | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return <Modal open={open} onOpenChange={onOpenChange}><BookForm book={book} onClose={() => onOpenChange(false)} /></Modal>;
}
function BookForm({ book, onClose }: { book: BookOut | null; onClose: () => void }) {
  const add = useAddBook();
  const edit = useEditBook();
  const m = book ? edit : add;
  const [v, setV] = React.useState({ title: book?.title ?? "", author: book?.author ?? "", isbn: book?.isbn ?? "", category: book?.category ?? "", copies: "1" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { title: v.title.trim(), author: v.author.trim(), isbn: v.isbn.trim() || null, category: v.category.trim() || null };
    if (book) edit.mutate({ id: book.id, body }, { onSuccess: () => { toast.success("Book updated"); onClose(); } });
    else add.mutate({ ...body, copies: Math.max(0, Math.min(200, Number(v.copies) || 0)) }, { onSuccess: (b) => { toast.success(`Added${b.copies.length ? ` with ${b.copies.length} ${b.copies.length === 1 ? "copy" : "copies"}` : ""}`); onClose(); } });
  }
  return (
    <>
      <DialogHeader><DialogTitle>{book ? "Edit book" : "Add a book"}</DialogTitle><DialogDescription>{book ? "Change the details. Copies are managed from the book." : "Each copy gets its own accession number."}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Title" htmlFor="bk-title"><Input id="bk-title" required value={v.title} maxLength={300} onChange={set("title")} /><FieldErr error={m.error} name="title" /></Field>
        <Field label="Author" htmlFor="bk-author"><Input id="bk-author" value={v.author} maxLength={200} onChange={set("author")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="bk-cat"><Input id="bk-cat" value={v.category} maxLength={100} onChange={set("category")} /></Field>
          <Field label="ISBN" htmlFor="bk-isbn"><Input id="bk-isbn" value={v.isbn} maxLength={20} onChange={set("isbn")} /><FieldErr error={m.error} name="isbn" /></Field>
        </div>
        {!book && <Field label="Copies to add" htmlFor="bk-copies" hint="You can add more later."><Input id="bk-copies" type="number" min={0} max={200} value={v.copies} onChange={set("copies")} /></Field>}
        <Alert error={m.error instanceof ApiError && Object.keys(m.error.fields).length ? null : m.error} />
        <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={m.isPending}>{book ? "Save" : "Add book"}</Button></DialogFooter>
      </form>
    </>
  );
}

/* ---------- issue ---------- */
type Who = { kind: "student" | "staff"; id: string; name: string; hint?: string };

function BorrowerPicker({ who, setWho }: { who: Who | null; setWho: (w: Who | null) => void }) {
  const [kind, setKind] = React.useState<"student" | "staff">("student");
  const [q, setQ] = React.useState("");
  const students = useStudentSearch(kind === "student" ? q : "");
  const staff = useStaffSearch(kind === "staff" ? q : "");
  const res = kind === "student" ? students : staff;
  const rows: Who[] = kind === "student"
    ? (students.data?.items ?? []).map((s) => ({ kind, id: s.id, name: s.name, hint: [s.class_label && `Class ${s.class_label}`, s.scholar_no].filter(Boolean).join(" · ") }))
    : (staff.data?.items ?? []).map((s) => ({ kind, id: s.id, name: s.name, hint: s.designation }));
  if (who) return <div className="flex items-center justify-between gap-3 rounded-xl bg-fill px-4 py-2.5 text-sm"><span><b>{who.name}</b> <span className="text-text-tertiary">{who.kind === "staff" ? "Staff" : "Student"}{who.hint ? ` · ${who.hint}` : ""}</span></span><Button type="button" size="sm" variant="ghost" onClick={() => setWho(null)}>Change</Button></div>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">{(["student", "staff"] as const).map((k) => <Button key={k} type="button" size="sm" variant={kind === k ? "default" : "secondary"} className="capitalize" onClick={() => { setKind(k); setQ(""); }}>{k}</Button>)}</div>
      <Input aria-label="Search borrower" placeholder={kind === "student" ? "Search a student by name or scholar number" : "Search a staff member by name"} value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim().length >= 2 && (res.isPending ? <p className="text-xs text-text-tertiary">Searching…</p> : res.isError ? <p className="text-xs text-destructive">{msg(res.error)}</p> : rows.length === 0 ? <p className="text-xs text-text-tertiary">No match.</p> : (
        <ul className="flex flex-col rounded-xl bg-fill p-1">{rows.slice(0, 8).map((r) => <li key={r.id}><button type="button" onClick={() => setWho(r)} className="flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-separator"><span className="font-medium">{r.name}</span><span className="truncate text-xs text-text-tertiary">{r.hint}</span></button></li>)}</ul>
      ))}
    </div>
  );
}

/** Issue a copy. Opened from a book (pick one of its available copies) or from the loans tab (type an accession number). */
export function IssueDialog({ book, open, onOpenChange }: { book: BookOut | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return <Modal open={open} onOpenChange={onOpenChange}><IssueForm book={book} onClose={() => onOpenChange(false)} /></Modal>;
}
function IssueForm({ book, onClose }: { book: BookOut | null; onClose: () => void }) {
  const issue = useIssue();
  const settings = useLibrarySettings();
  const detail = useBook(book?.id ?? null);
  const [accession, setAccession] = React.useState("");
  const [copyId, setCopyId] = React.useState("");
  const [who, setWho] = React.useState<Who | null>(null);
  const [due, setDue] = React.useState("");
  const lookup = useCopyLookup(book ? "" : accession);
  const available = (detail.data?.copies ?? []).filter((c) => c.status === "available");
  const copy = book ? available.find((c) => c.id === copyId) ?? available[0] : lookup.data;
  const ok = !!copy && copy.status === "available" && !!who;
  return (
    <>
      <DialogHeader><DialogTitle>Issue a book</DialogTitle><DialogDescription>{book ? book.title : "Scan or type the accession number of the copy."}</DialogDescription></DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        if (!copy || !who) return;
        issue.mutate({ copy_id: copy.id, student_id: who.kind === "student" ? who.id : null, staff_id: who.kind === "staff" ? who.id : null, due_on: due || null }, { onSuccess: (l) => { toast.success(`Issued. Due ${formatDateOn(l.due_on)}`); onClose(); } });
      }}>
        {book ? (
          <Field label="Copy" htmlFor="is-copy">
            {detail.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : available.length === 0 ? <p className="text-sm text-destructive">No copy of this book is available right now.</p> : (
              <NativeSelect id="is-copy" value={copy?.id ?? ""} onChange={(e) => setCopyId(e.target.value)}>{available.map((c) => <option key={c.id} value={c.id}>{c.accession_no}</option>)}</NativeSelect>
            )}
          </Field>
        ) : (
          <Field label="Accession number" htmlFor="is-acc">
            <Input id="is-acc" value={accession} autoFocus onChange={(e) => setAccession(e.target.value)} placeholder="LIB-00001" />
            {accession.trim() && (lookup.isPending ? <p className="text-xs text-text-tertiary">Looking up…</p> : lookup.isError ? <p className="text-xs text-destructive">{msg(lookup.error)}</p> : <p className="text-xs text-muted-foreground"><b className="text-foreground">{lookup.data.book_title}</b> · <span className="capitalize">{lookup.data.status}</span>{lookup.data.status !== "available" ? ". It cannot be issued." : ""}</p>)}
          </Field>
        )}
        <Field label="Borrower"><BorrowerPicker who={who} setWho={setWho} /></Field>
        <Field label="Due on" htmlFor="is-due" hint={settings.data ? `Leave empty for ${settings.data.loan_days} days from today.` : undefined}><Input id="is-due" type="date" min={todayOnIST()} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Alert error={issue.error} />
        <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={issue.isPending} disabled={!ok}>Issue</Button></DialogFooter>
      </form>
    </>
  );
}

/* ---------- return ---------- */
export function ReturnDialog({ loan, onClose }: { loan: LoanOut | null; onClose: () => void }) {
  return <Modal open={!!loan} onOpenChange={(o) => { if (!o) onClose(); }}>{loan && <ReturnForm loan={loan} onClose={onClose} />}</Modal>;
}
function ReturnForm({ loan, onClose }: { loan: LoanOut; onClose: () => void }) {
  const ret = useReturn();
  const [cond, setCond] = React.useState<"good" | "damaged" | "lost">("good");
  const [fine, setFine] = React.useState("");
  const [waive, setWaive] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const override = fine.trim() !== "" ? Math.round(Number(fine) * 100) : null;
  const bad = override !== null && (!Number.isFinite(override) || override < 0);
  const charge = waive ? 0 : override ?? loan.fine_paise;
  return (
    <>
      <DialogHeader><DialogTitle>Return book</DialogTitle><DialogDescription>{loan.title} · {loan.accession_no} · {loan.student_name ?? loan.staff_name}</DialogDescription></DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        ret.mutate({ id: loan.id, body: { condition: cond, fine_paise: waive ? null : override, waive_fine: waive, waive_reason: waive ? reason.trim() || null : null } }, { onSuccess: () => { toast.success(cond === "good" ? "Book returned" : cond === "lost" ? "Marked as lost" : "Returned as damaged"); onClose(); } });
      }}>
        <Field label="Condition" htmlFor="rt-cond"><NativeSelect id="rt-cond" value={cond} onChange={(e) => setCond(e.target.value as typeof cond)}><option value="good">Good</option><option value="damaged">Damaged</option><option value="lost">Lost</option></NativeSelect></Field>
        {loan.overdue && <p className="rounded-xl bg-fill px-4 py-2.5 text-sm">{loan.days_overdue} {loan.days_overdue === 1 ? "day" : "days"} late. Fine so far: <b>{formatINR(loan.fine_paise)}</b>.</p>}
        {!waive && <Field label="Fine in rupees" htmlFor="rt-fine" hint="Leave empty to charge the fine above. Use it for a replacement charge."><Input id="rt-fine" type="number" min={0} step="0.01" value={fine} onChange={(e) => setFine(e.target.value)} /></Field>}
        {(loan.fine_paise > 0 || waive) && (
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={waive} onCheckedChange={(c) => setWaive(c === true)} /> Waive the fine</label>
        )}
        {charge > 0 && !bad && (loan.borrower_type === "student"
          ? <p className="rounded-xl bg-fill px-4 py-2.5 text-sm">A fee invoice of <b>{formatINR(charge)}</b> will be created for the student. It is paid like any other fee.</p>
          : <p className="rounded-xl bg-fill px-4 py-2.5 text-sm">Staff fine of <b>{formatINR(charge)}</b>: it is only recorded here. Collect it manually.</p>)}
        {waive && <Field label="Reason" htmlFor="rt-reason"><Input id="rt-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>}
        <Alert error={ret.error} />
        <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={ret.isPending} disabled={bad || (waive && !reason.trim())}>Return</Button></DialogFooter>
      </form>
    </>
  );
}

/* ---------- settings ---------- */
export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <Modal open={open} onOpenChange={onOpenChange}><SettingsForm onClose={() => onOpenChange(false)} /></Modal>;
}
function SettingsForm({ onClose }: { onClose: () => void }) {
  const q = useLibrarySettings();
  const save = useSaveSettings();
  const [days, setDays] = React.useState<string | null>(null);
  const [fine, setFine] = React.useState<string | null>(null);
  const d = days ?? String(q.data?.loan_days ?? "");
  const f = fine ?? (q.data ? String(q.data.fine_per_day_paise / 100) : "");
  return (
    <>
      <DialogHeader><DialogTitle>Library rules</DialogTitle><DialogDescription>Used when a book is issued, renewed or returned late.</DialogDescription></DialogHeader>
      {q.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : q.isError ? <Alert error={q.error} /> : (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ loan_days: Number(d), fine_per_day_paise: Math.round(Number(f) * 100) }, { onSuccess: () => { toast.success("Rules saved"); onClose(); } }); }}>
          <Field label="Loan period in days" htmlFor="st-days"><Input id="st-days" type="number" min={1} max={365} value={d} onChange={(e) => setDays(e.target.value)} /><FieldErr error={save.error} name="loan_days" /></Field>
          <Field label="Fine per overdue day, in rupees" htmlFor="st-fine" hint="0 means no fine."><Input id="st-fine" type="number" min={0} step="0.5" value={f} onChange={(e) => setFine(e.target.value)} /><FieldErr error={save.error} name="fine_per_day_paise" /></Field>
          <Alert error={save.error instanceof ApiError && Object.keys(save.error.fields).length ? null : save.error} />
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={save.isPending}>Save</Button></DialogFooter>
        </form>
      )}
    </>
  );
}

export const StatusBadge = ({ l }: { l: Pick<LoanOut, "status" | "overdue"> }) =>
  l.status === "returned" ? <Badge tone="success">Returned</Badge> : l.status === "lost" ? <Badge tone="danger">Lost</Badge> : l.status === "damaged" ? <Badge tone="warning">Damaged</Badge> : l.overdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone="brand">On loan</Badge>;
