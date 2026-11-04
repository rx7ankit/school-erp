"use client";
import * as React from "react";
import { Search, Send, UserPlus, Upload, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorBlock } from "@/components/app/academic-live-ui";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Pager } from "@/components/app/pager";
import { DownloadButton, Problem } from "@/components/app/school-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Appear, SkTableRows } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { downloadParents, useParentListFile, useParentListLines, useParents, useSendParentLogins, type LoginFilter, type ParentListOut, type ParentRow, type ParentSendOut } from "@/lib/api/hooks/parents";
import { errorText } from "@/lib/api/hooks/staff";
import { formatIST } from "@/lib/time";

const SIZE = 25;
const STATUS: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "danger" }> = {
  none: { label: "No login", tone: "neutral" }, pending: { label: "Not sent", tone: "neutral" }, sent: { label: "Sent", tone: "warning" }, failed: { label: "Failed", tone: "danger" }, active: { label: "Active", tone: "success" },
};

function sentToast(r: ParentSendOut) {
  const extra = [r.skipped_no_email ? `${r.skipped_no_email} skipped (no email)` : "", r.created ? `${r.created} new ${r.created === 1 ? "login" : "logins"} created` : ""].filter(Boolean).join(", ");
  if (r.failed) toast.error(`${r.failed} failed`, { description: [r.sent ? `${r.sent} sent.` : "", extra].filter(Boolean).join(" ") || undefined });
  else if (!r.sent) toast.message("Nothing sent", { description: extra || undefined });
  else toast.success(r.sent === 1 ? "Login sent" : `${r.sent} logins sent`, { description: extra || undefined });
}

export function ParentsLive() {
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [login, setLogin] = React.useState<"" | LoginFilter>("");
  const [page, setPage] = React.useState(0);
  const [dlg, setDlg] = React.useState<"list" | null>(null);
  React.useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const filters = { q: q.trim() || undefined, login: login || undefined };
  const list = useParents({ ...filters, limit: SIZE, offset: page * SIZE });
  const waiting = useParents({ login: "waiting", limit: 1 });
  const send = useSendParentLogins();
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const nWaiting = waiting.data?.total ?? 0;
  const sendIds = (ids?: string[]) => send.mutate(ids, { onSuccess: sentToast, onError: (e) => toast.error(errorText(e)) });
  const sendingId = send.isPending ? (send.variables?.length === 1 ? send.variables[0] : "all") : null;

  return (
    <>
      <PageHeader title="Parents"
        actions={<>
          <DownloadButton run={() => downloadParents(filters)} />
          <Button variant="secondary" onClick={() => setDlg("list")}><UserPlus /> Add list</Button>
          <Button variant="brand" disabled={!nWaiting} loading={sendingId === "all"} onClick={() => sendIds()}>{sendingId !== "all" && <Send />} Send {nWaiting}</Button>
        </>} />
      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
            <Input aria-label="Search parents" className="rounded-full pl-10" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <NativeSelect aria-label="Filter by login status" className="w-44" value={login} onChange={(e) => { setLogin(e.target.value as "" | LoginFilter); setPage(0); }}>
            <option value="">All</option><option value="waiting">Waiting</option><option value="none">No login</option><option value="pending">Not sent</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="active">Active</option>
          </NativeSelect>
        </div>
        {list.isPending ? (
          <Table className="min-w-[820px]">
            <TableHeader><TableRow><TableHead>Parent</TableHead><TableHead>Children</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead className="text-right"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
            <TableBody><SkTableRows cols={5} rows={6} /></TableBody>
          </Table>
        ) : list.isError ? <ErrorBlock error={list.error} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState icon={UsersRound} title={q || login ? "No matches" : "No parents"} />
        ) : (
          <Appear><div className={list.isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}>
            <Table className="min-w-[820px]">
              <TableHeader><TableRow><TableHead>Parent</TableHead><TableHead>Children</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead className="text-right"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => <Row key={r.guardian_id} r={r} busy={sendingId === r.guardian_id} onSend={() => sendIds([r.guardian_id])} />)}
              </TableBody>
            </Table>
            <Pager page={page} pages={Math.max(1, Math.ceil(total / SIZE))} total={total} size={SIZE} setPage={setPage} />
          </div></Appear>
        )}
      </Card>
      <ListDialog open={dlg === "list"} onClose={() => setDlg(null)} />
    </>
  );
}

function Row({ r, busy, onSend }: { r: ParentRow; busy: boolean; onSend: () => void }) {
  const st = STATUS[r.login_status] ?? STATUS.none;
  const fresh = r.login_status === "none" || r.login_status === "pending";
  return (
    <TableRow>
      <TableCell><p className="font-medium">{r.name}</p><p className="text-xs text-text-tertiary">{r.email ?? "No email"}{r.phone ? ` · ${r.phone}` : ""}</p></TableCell>
      <TableCell>{r.children.map((c) => <span key={c.student_id} className="mr-1.5 inline-block"><Badge tone={r.children.length > 1 ? "brand" : "neutral"}>{c.name} · {c.class_label ?? "—"}</Badge></span>)}</TableCell>
      <TableCell><Badge tone={st.tone}>{st.label}</Badge>{r.last_login_at && <p className="mt-1 text-xs tabular-nums text-text-tertiary">In {formatIST(r.last_login_at, "short")}</p>}</TableCell>
      <TableCell className="tabular-nums text-muted-foreground">{r.login_sent_at ? formatIST(r.login_sent_at) : "—"}</TableCell>
      <TableCell className="text-right">{r.email
        ? <Button size="sm" variant={fresh ? "brand" : "secondary"} loading={busy} onClick={onSend}>{fresh ? "Send" : "Resend"}</Button>
        : <span className="text-xs text-text-tertiary">No email</span>}</TableCell>
    </TableRow>
  );
}

/** "scholar no, guardian name, email, mobile" lines or an Excel file: check first (dry run), then create. */
function ListDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Dialog open={open} onOpenChange={(o) => !o && onClose()}><DialogContent><ListForm onClose={onClose} /></DialogContent></Dialog>;
}

function ListForm({ onClose }: { onClose: () => void }) {
  const lines = useParentListLines(), file = useParentListFile();
  const [text, setText] = React.useState("");
  const [picked, setPicked] = React.useState<File | null>(null);
  const [res, setRes] = React.useState<ParentListOut | null>(null);
  const [send, setSend] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const parsed = React.useMemo(() => text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [scholar_no, name, email, mobile] = l.split(/[,\t]/).map((x) => x.trim());
    return { scholar_no, name, email, mobile: mobile || undefined };
  }), [text]);
  const busy = lines.isPending || file.isPending;

  function run(dry: boolean) {
    setErr(null);
    const done = { onSuccess: (r: ParentListOut) => { setRes(r); if (!dry) { toast.success(`${r.parents} ${r.parents === 1 ? "login" : "logins"} ready`); onClose(); } }, onError: (e: unknown) => setErr(errorText(e)) };
    if (picked) file.mutate({ file: picked, dry_run: dry, send_login: send }, done);
    else lines.mutate({ rows: parsed.map((p) => ({ scholar_no: p.scholar_no ?? "", name: p.name ?? "", email: p.email ?? "", mobile: p.mobile, relation: "other" as const })), dry_run: dry, send_login: send }, done);
  }
  const ready = !!picked || parsed.length > 0;
  return (
    <>
        <DialogHeader><DialogTitle>Add list</DialogTitle>
          <DialogDescription>Scholar no, name, email, mobile</DialogDescription></DialogHeader>
        <Field label="List" htmlFor="plist"><Textarea id="plist" disabled={!!picked} value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} placeholder={"RPS2001, Rakesh Tiwari, rakesh@example.in, 9000011111\nRPS2008, Rakesh Tiwari, rakesh@example.in"} className="font-mono text-[13px]" /></Field>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <input ref={input} type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Parent list file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPicked(f); setRes(null); } e.target.value = ""; }} />
          <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()}><Upload /> Excel file</Button>
          {picked && <><span className="break-all text-muted-foreground">{picked.name}</span><Button type="button" variant="ghost" size="sm" onClick={() => { setPicked(null); setRes(null); }}>Remove</Button></>}
        </div>
        <div className="flex items-center gap-3"><Checkbox id="psend" checked={send} onCheckedChange={(c) => { setSend(c === true); }} /><Label htmlFor="psend">Email logins</Label></div>
        {res && (
          <div className="flex flex-col gap-1 text-sm" role="status">
            <p className="text-muted-foreground">{res.total_rows - res.error_rows}/{res.total_rows} ready</p>
            {res.errors.slice(0, 10).map((e) => <p key={e.row_no} className="text-danger">Line {e.row_no}: {e.error}</p>)}
            {res.errors.length > 10 && <p className="text-danger">+{res.errors.length - 10} more</p>}
          </div>
        )}
        <Problem text={err} />
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {res && res.error_rows === 0 && res.dry_run
            ? <Button variant="brand" loading={busy} onClick={() => run(false)}>Create {res.parents} {res.parents === 1 ? "login" : "logins"}</Button>
            : <Button variant="brand" disabled={!ready} loading={busy} onClick={() => run(true)}>Check</Button>}
        </DialogFooter>
    </>
  );
}
