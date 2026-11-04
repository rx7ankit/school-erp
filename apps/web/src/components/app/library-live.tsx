"use client";
import * as React from "react";
import { BookPlus, Download, Pencil, Search, Settings2, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { BookDialog, IssueDialog, ReturnDialog, SettingsDialog, StatusBadge, msg } from "@/components/app/library-live-dialogs";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { Pager } from "@/components/app/pager";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Appear, SkPage, SkTableRows, Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadFile } from "@/lib/api/download";
import { PAGE, useAddCopies, useBook, useBooks, useDeleteBook, useLoans, useRenew, useSetCopyStatus, type LoanQuery } from "@/lib/api/hooks/library";
import type { BookOut, LoanFilter, LoanOut } from "@/lib/api/types";
import { formatDateOn, formatINR, formatIST } from "@/lib/time";

const Err = ({ error, retry }: { error: unknown; retry: () => void }) => (
  <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-fill p-4 text-sm text-destructive"><span>{msg(error)}</span><Button size="sm" variant="secondary" onClick={retry}>Retry</Button></div>
);

/* ---------- one book: copies ---------- */
function BookDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  return <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}><DialogContent className="max-w-xl">{id && <BookDetailBody id={id} onClose={onClose} />}</DialogContent></Dialog>;
}
function BookDetailBody({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useBook(id);
  const setStatus = useSetCopyStatus();
  const addCopies = useAddCopies();
  const del = useDeleteBook();
  const [count, setCount] = React.useState("1");
  const [acc, setAcc] = React.useState("");
  if (q.isPending) return (
    <SkPage className="gap-4">
      <DialogTitle className="sr-only">Book</DialogTitle>
      <div><Skeleton className="h-6 w-2/3" /><Skeleton className="mt-2 h-3.5 w-1/2" /></div>
      <Skeleton className="h-3.5 w-3/4" />
      <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 rounded-xl" />)}</div>
    </SkPage>
  );
  if (q.isError) return <Err error={q.error} retry={() => q.refetch()} />;
  const b = q.data;
  const n = Math.max(1, Math.min(200, Number(count) || 1));
  return (
    <>
      <DialogHeader><DialogTitle>{b.title}</DialogTitle><DialogDescription>{[b.author, b.category, b.isbn].filter(Boolean).join(" · ")}</DialogDescription></DialogHeader>
      <p className="text-sm text-muted-foreground">{b.copies_total} copies · {b.available} available · {b.issued} issued{b.lost ? ` · ${b.lost} lost` : ""}{b.damaged ? ` · ${b.damaged} damaged` : ""}</p>
      {b.copies.length > 0 && (
        <ul className="flex max-h-64 flex-col overflow-y-auto">
          {b.copies.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0">
              <span className="font-medium tabular-nums">{c.accession_no}</span>
              <span className="flex items-center gap-2">
                <Badge tone={c.status === "available" ? "success" : c.status === "issued" ? "brand" : "danger"} className="capitalize">{c.status === "issued" ? "Issued" : c.status}</Badge>
                {c.status !== "issued" && (
                  <NativeSelect aria-label={`Status of ${c.accession_no}`} className="w-32" value={c.status} onChange={(e) => setStatus.mutate({ id: c.id, status: e.target.value as "available" | "lost" | "damaged" }, { onSuccess: () => toast.success("Saved"), onError: (er) => toast.error(msg(er)) })}>
                    <option value="available">Available</option><option value="damaged">Damaged</option><option value="lost">Lost</option>
                  </NativeSelect>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-wrap items-end gap-3 border-t border-border pt-4" onSubmit={(e) => { e.preventDefault(); addCopies.mutate({ id, count: acc.trim() ? 1 : n, accession_no: acc.trim() || null }, { onSuccess: (r) => { toast.success(`Added ${r.length}`); setAcc(""); } }); }}>
        <Field label="Copies" htmlFor="ac-n"><Input id="ac-n" type="number" min={1} max={200} className="w-24" value={acc.trim() ? "1" : count} disabled={!!acc.trim()} onChange={(e) => setCount(e.target.value)} /></Field>
        <Field label="Number" htmlFor="ac-acc"><Input id="ac-acc" className="w-44" value={acc} placeholder="Auto" onChange={(e) => setAcc(e.target.value)} /></Field>
        <Button type="submit" variant="secondary" loading={addCopies.isPending}>Add</Button>
      </form>
      {(addCopies.isError || setStatus.isError || del.isError) && <p role="alert" className="text-sm text-destructive">{msg(addCopies.error ?? setStatus.error ?? del.error)}</p>}
      <DialogFooter>
        {b.copies_total === 0 && <Button variant="ghost" className="text-destructive" loading={del.isPending} onClick={() => del.mutate(id, { onSuccess: () => { toast.success("Deleted"); onClose(); } })}>Delete</Button>}
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </DialogFooter>
    </>
  );
}

/* ---------- books ---------- */
function Books({ onIssue }: { onIssue: (b: BookOut) => void }) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [availableOnly, setAvailableOnly] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [edit, setEdit] = React.useState<BookOut | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [open, setOpen] = React.useState<string | null>(null);
  const [term, setTerm] = React.useState("");
  React.useEffect(() => { const t = setTimeout(() => { setQ(term); setPage(0); }, 300); return () => clearTimeout(t); }, [term]);
  const books = useBooks({ q, category, availableOnly }, page * PAGE);
  const total = books.data?.total ?? 0;
  const cats = useBooks({ q: "", category: "", availableOnly: false }, 0).data?.items ?? [];
  const categories = [...new Set(cats.map((b) => b.category).filter((c): c is string => !!c))].sort();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" /><Input aria-label="Search books" className="pl-10" placeholder="Search" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
        {categories.length > 0 && <NativeSelect aria-label="Category" className="w-48" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }}><option value="">All</option>{categories.map((c) => <option key={c}>{c}</option>)}</NativeSelect>}
        <Button variant={availableOnly ? "default" : "secondary"} aria-pressed={availableOnly} onClick={() => { setAvailableOnly(!availableOnly); setPage(0); }}>Available</Button>
        <Button variant="accent" onClick={() => setAddOpen(true)}><BookPlus /> Add</Button>
      </div>
      <Card>
        {books.isPending ? (
          <Table className="min-w-[820px]">
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Copies</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody><SkTableRows cols={6} rows={6} /></TableBody>
          </Table>
        ) : books.isError ? <Err error={books.error} retry={() => books.refetch()} /> : (
          <Appear>
            <Table className="min-w-[820px]">
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Copies</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {books.data.items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{q || category || availableOnly ? "No books." : "No books."}</TableCell></TableRow>}
                {books.data.items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell><button type="button" className="text-left font-medium hover:underline" onClick={() => setOpen(b.id)}>{b.title}</button><p className="text-xs text-text-tertiary">{[b.author, b.isbn].filter(Boolean).join(" · ")}</p></TableCell>
                    <TableCell className="text-muted-foreground">{b.category ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.copies_total}{b.lost + b.damaged > 0 && <span className="text-xs text-text-tertiary"> (−{b.lost + b.damaged})</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.available}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.issued}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="secondary" disabled={b.available === 0} onClick={() => onIssue(b)}>Issue</Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${b.title}`} onClick={() => setEdit(b)}><Pencil /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE))} total={total} size={PAGE} setPage={setPage} />
          </Appear>
        )}
      </Card>
      <BookDialog book={null} open={addOpen} onOpenChange={setAddOpen} />
      <BookDialog book={edit} open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }} />
      <BookDetailDialog id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/* ---------- loans ---------- */
/** Where the fine of a returned loan stands: its fee invoice (student) or "collect manually" (staff). */
function FineChip({ l }: { l: LoanOut }) {
  const tone = { unpaid: "danger", partial: "warning", paid: "success", closed: "neutral", manual: "warning" } as const;
  const label = { unpaid: "Fee unpaid", partial: `${formatINR(l.fine_balance_paise)} left`, paid: "Fee paid", closed: "Carried", manual: "Collect manually" } as const;
  if (l.fine_status === "none" || l.fine_status === "waived") return null;
  return (
    <p className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
      <Badge tone={tone[l.fine_status]}>{label[l.fine_status]}</Badge>
      {l.fine_invoice_no && <Link href="/fees" className="text-xs text-foreground hover:underline">{l.fine_invoice_no}</Link>}
    </p>
  );
}

const FILTERS: [LoanFilter, string][] = [["open", "Issued"], ["overdue", "Overdue"], ["returned", "Returned"], ["lost", "Lost"], ["damaged", "Damaged"], ["all", "All"]];

function Loans({ onIssue }: { onIssue: () => void }) {
  const [status, setStatus] = React.useState<LoanFilter>("open");
  const [term, setTerm] = React.useState("");
  const [q, setQ] = React.useState("");
  const [who, setWho] = React.useState<{ id: string; staff: boolean; name: string } | null>(null);
  const [page, setPage] = React.useState(0);
  const [ret, setRet] = React.useState<LoanOut | null>(null);
  React.useEffect(() => { const t = setTimeout(() => { setQ(term); setPage(0); }, 300); return () => clearTimeout(t); }, [term]);
  const query: LoanQuery = { status: who ? "all" : status, q, student_id: who && !who.staff ? who.id : undefined, staff_id: who?.staff ? who.id : undefined };
  const loans = useLoans(query, page * PAGE);
  const renew = useRenew();
  const [exporting, setExporting] = React.useState(false);
  const total = loans.data?.total ?? 0;
  async function exportXlsx() {
    setExporting(true);
    try { await downloadFile("/library/export", { status: query.status, q: q.trim() || undefined, student_id: query.student_id, staff_id: query.staff_id }, "library.xlsx"); toast.success("Downloaded"); }
    catch (e) { toast.error(msg(e)); } finally { setExporting(false); }
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" /><Input aria-label="Search loans" className="pl-10" placeholder="Search" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
        <Button variant="secondary" loading={exporting} onClick={exportXlsx}>{!exporting && <Download />} Export</Button>
        <Button variant="brand" onClick={onIssue}>Issue</Button>
      </div>
      {who ? (
        <div className="flex items-center gap-2 text-sm"><Badge tone="brand">{who.name}</Badge><Button size="sm" variant="ghost" onClick={() => { setWho(null); setPage(0); }}><X /> Clear</Button></div>
      ) : (
        <div className="flex flex-wrap gap-1.5">{FILTERS.map(([v, l]) => <Button key={v} size="sm" variant={status === v ? "default" : "secondary"} onClick={() => { setStatus(v); setPage(0); }}>{l}</Button>)}</div>
      )}
      <Card>
        {loans.isPending ? (
          <Table className="min-w-[900px]">
            <TableHeader><TableRow><TableHead>Book</TableHead><TableHead>Borrower</TableHead><TableHead>Issued</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Fine</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody><SkTableRows cols={7} rows={6} /></TableBody>
          </Table>
        ) : loans.isError ? <Err error={loans.error} retry={() => loans.refetch()} /> : (
          <Appear>
            <Table className="min-w-[900px]">
              <TableHeader><TableRow><TableHead>Book</TableHead><TableHead>Borrower</TableHead><TableHead>Issued</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Fine</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {loans.data.items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{q || who ? "No loans." : "No loans."}</TableCell></TableRow>}
                {loans.data.items.map((l) => {
                  const name = l.student_name ?? l.staff_name ?? "—";
                  const open = l.status === "open" || l.status === "overdue";
                  return (
                    <TableRow key={l.id}>
                      <TableCell><p className="font-medium">{l.title}</p><p className="text-xs text-text-tertiary">{l.accession_no}{l.author ? ` · ${l.author}` : ""}</p></TableCell>
                      <TableCell>
                        <button type="button" className="text-left font-medium hover:underline" onClick={() => { setWho({ id: (l.student_id ?? l.staff_id)!, staff: l.borrower_type === "staff", name }); setPage(0); }}>{name}</button>
                        <p className="text-xs text-text-tertiary">{l.borrower_type === "staff" ? "Staff" : `Student${l.scholar_no ? ` · ${l.scholar_no}` : ""}`}</p>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{formatIST(l.issued_at, "date")}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{formatDateOn(l.due_on)}{l.overdue && <p className="text-xs text-danger">{l.days_overdue}d late</p>}</TableCell>
                      <TableCell><StatusBadge l={l} />{l.renewals > 0 && <p className="mt-1 text-xs text-text-tertiary">Renewed ×{l.renewals}</p>}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.fine_paise ? formatINR(l.fine_paise) : "—"}{l.fine_waived_paise > 0 && <p className="text-xs text-text-tertiary" title={l.waive_reason ?? undefined}>{formatINR(l.fine_waived_paise)} waived</p>}<FineChip l={l} /></TableCell>
                      <TableCell className="text-right">{open ? <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setRet(l)}>Return</Button>
                        <Button size="sm" variant="ghost" disabled={l.overdue || renew.isPending} onClick={() => renew.mutate(l.id, { onSuccess: (r) => toast.success(`Due ${formatDateOn(r.due_on)}`), onError: (e) => toast.error(msg(e)) })}>Renew</Button>
                      </div> : <span className="text-xs text-muted-foreground">{l.returned_at ? formatIST(l.returned_at, "date") : ""}</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE))} total={total} size={PAGE} setPage={setPage} />
          </Appear>
        )}
      </Card>
      <ReturnDialog loan={ret} onClose={() => setRet(null)} />
    </div>
  );
}

/** The library on the real API. */
export function LibraryLive() {
  const { me } = useSession();
  const [issueFor, setIssueFor] = React.useState<{ book: BookOut | null } | null>(null);
  const [settings, setSettings] = React.useState(false);
  if (!me) return null;
  if (!me.is_admin && !me.permissions.includes("library.manage")) return <NoAccess need="the Library permission" />;
  return (
    <>
      <PageHeader title="Library."
        actions={<Button variant="secondary" onClick={() => setSettings(true)}><Settings2 /> Rules</Button>} />
      <Tabs defaultValue="books">
        <TabsList><TabsTrigger value="books">Books</TabsTrigger><TabsTrigger value="loans">Loans</TabsTrigger></TabsList>
        <TabsContent value="books"><Books onIssue={(b) => setIssueFor({ book: b })} /></TabsContent>
        <TabsContent value="loans"><Loans onIssue={() => setIssueFor({ book: null })} /></TabsContent>
      </Tabs>
      <IssueDialog book={issueFor?.book ?? null} open={!!issueFor} onOpenChange={(o) => { if (!o) setIssueFor(null); }} />
      <SettingsDialog open={settings} onOpenChange={setSettings} />
    </>
  );
}
