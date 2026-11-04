"use client";
import * as React from "react";
import { KeyRound, MoreHorizontal, Pencil, Plus, Search, Send, UserMinus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Field } from "@/components/app/field";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkTableRows } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorText, useAddStaff, useAddStaffBulk, useEditStaff, useRemoveStaff, useSendLogin, useSetPermissions, useStaffList } from "@/lib/api/hooks/staff";
import type { Permission, StaffOut } from "@/lib/api/types";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { formatIST } from "@/lib/time";

type Mode = { kind: "perms" | "edit" | "remove"; id: string } | null;
const PERMS = Object.keys(PERMISSION_LABELS) as Permission[];
const INVITE: Record<string, readonly [string, "neutral" | "warning" | "success" | "danger"]> = {
  pending: ["Not sent", "neutral"], sent: ["Sent", "warning"], failed: ["Failed", "danger"], active: ["Active", "success"],
};

function Problem({ text }: { text: string | null }) {
  return text ? <p role="alert" className="text-sm text-danger">{text}</p> : null;
}

/** Staff page on the real API. Class assignments and "absent today" are not editable here: the API has no endpoint for them. */
export function StaffLive() {
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  React.useEffect(() => { const t = setTimeout(() => setQ(search), 300); return () => clearTimeout(t); }, [search]);
  const list = useStaffList(q);
  const rows = React.useMemo(() => list.data?.items ?? [], [list.data]);
  const [mode, setMode] = React.useState<Mode>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [sendNow, setSendNow] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const add = useAddStaff(), bulk = useAddStaffBulk(), edit = useEditStaff(), setPerms = useSetPermissions(), send = useSendLogin(), remove = useRemoveStaff();
  const sel = rows.find((r) => r.id === mode?.id);
  const close = () => { setMode(null); setErr(null); };
  const pending = rows.filter((r) => r.is_active && r.invite_status === "pending" && !r.last_login_at);
  const sendingId = send.isPending ? (send.variables?.length === 1 ? send.variables[0] : "all") : null;

  const sendLogin = (ids?: string[]) => send.mutate(ids, {
    onSuccess: (r) => r.failed ? toast.error(`${r.failed} failed`, { description: r.sent ? `${r.sent} sent.` : undefined })
      : toast.success(r.sent === 1 ? "Login sent" : `${r.sent} logins sent`),
    onError: (e) => toast.error(errorText(e)),
  });

  function addOne(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const send_login = f.get("send") === "on";
    setErr(null);
    add.mutate({ name: s("name"), designation: s("designation"), department: s("department"), email: s("email"), phone: s("phone") || null, send_login }, {
      onSuccess: (r) => { setAddOpen(false); toast.success(`${r.name} added`); },
      onError: (e) => setErr(errorText(e)),
    });
  }

  // "name, designation, email" per line
  const parsed = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, designation, email] = l.split(/[,\t]/).map((x) => x.trim());
    return { name: name ?? "", designation: designation ?? "", email: email ?? "", ok: (name ?? "").length >= 2 && !!designation && /^\S+@\S+\.\S+$/.test(email ?? "") };
  });
  const valid = parsed.filter((p) => p.ok);
  const addList = () => {
    setErr(null);
    bulk.mutate({ rows: valid.map(({ name, designation, email }) => ({ name, designation, email })), send_login: sendNow }, {
      onSuccess: (r) => { setListOpen(false); setText(""); toast.success(`${r.total} staff added`); },
      onError: (e) => setErr(errorText(e)),
    });
  };

  const status = (s: StaffOut) => (s.last_login_at ? "active" : s.invite_status);

  return (
    <>
      <PageHeader title="Staff"
        actions={<>
          <Button variant="secondary" onClick={() => { setErr(null); setListOpen(true); }}><UsersRound /> Add list</Button>
          <Button variant="accent" onClick={() => { setErr(null); setAddOpen(true); }}><Plus /> Add staff</Button>
        </>} />
      {pending.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm"><b>{pending.length}</b> without login</p>
          <Button variant="brand" size="sm" loading={sendingId === "all"} onClick={() => sendLogin()}><Send /> Send all</Button>
        </Card>
      )}
      <Card className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input aria-label="Search staff" className="rounded-full pl-10" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {list.isError ? (
          <div className="flex flex-col items-start gap-3 py-6"><Problem text={errorText(list.error)} /><Button variant="secondary" size="sm" onClick={() => list.refetch()}>Retry</Button></div>
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Classes</TableHead><TableHead>Access</TableHead><TableHead>Login</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.isPending && <SkTableRows cols={5} rows={6} />}
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><div><p className="font-medium">{s.name}</p><p className="text-xs text-text-tertiary">{[s.designation, s.email].filter(Boolean).join(" · ")}</p></div></div></TableCell>
                  <TableCell>{s.assignments.length ? <Badge>{s.assignments.length} {s.assignments.length === 1 ? "class" : "classes"}</Badge> : <span className="text-text-tertiary">—</span>}</TableCell>
                  <TableCell>{s.is_admin ? <Badge tone="brand">Admin</Badge> : s.permissions.length ? s.permissions.map((p) => <span key={p} className="mr-1.5 inline-block"><Badge>{PERMISSION_LABELS[p as Permission] ?? p}</Badge></span>) : <span className="text-text-tertiary">—</span>}</TableCell>
                  <TableCell>
                    {s.is_active ? <Badge tone={(INVITE[status(s)] ?? INVITE.pending)[1]}>{(INVITE[status(s)] ?? INVITE.pending)[0]}</Badge> : <Badge tone="danger">Removed</Badge>}
                    {s.is_active && (s.last_login_at ?? s.login_sent_at) && <p className="mt-1 text-xs tabular-nums text-text-tertiary">{formatIST((s.last_login_at ?? s.login_sent_at)!, "short")}</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.is_active && (
                      <div className="flex justify-end gap-1.5">
                        {status(s) === "pending" && <Button size="sm" variant="brand" loading={sendingId === s.id} onClick={() => sendLogin([s.id])}>Send login</Button>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon-sm" variant="secondary" aria-label={`Manage ${s.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => { setErr(null); setMode({ kind: "edit", id: s.id }); }}><Pencil /> Edit</DropdownMenuItem>
                            {!s.is_admin && <DropdownMenuItem onSelect={() => { setErr(null); setMode({ kind: "perms", id: s.id }); }}><KeyRound /> Access</DropdownMenuItem>}
                            {status(s) !== "pending" && <DropdownMenuItem onSelect={() => sendLogin([s.id])}><Send /> Resend login</DropdownMenuItem>}
                            {!s.is_admin && (<><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => { setErr(null); setMode({ kind: "remove", id: s.id }); }}><UserMinus /> Remove</DropdownMenuItem></>)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {list.isSuccess && rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">{q ? "No matches." : "No staff."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add staff</DialogTitle><DialogDescription className="sr-only">Staff details.</DialogDescription></DialogHeader>
          <form onSubmit={addOne} className="flex flex-col gap-4">
            <Field label="Name" htmlFor="name"><Input id="name" name="name" required minLength={2} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Designation" htmlFor="designation"><Input id="designation" name="designation" required /></Field>
              <Field label="Department" htmlFor="department"><Input id="department" name="department" /></Field>
              <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required /></Field>
              <Field label="Mobile" htmlFor="phone"><Input id="phone" name="phone" inputMode="tel" /></Field>
            </div>
            <div className="flex items-center gap-3"><Checkbox id="send" name="send" defaultChecked /><Label htmlFor="send">Send login</Label></div>
            <Problem text={err} />
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" variant="brand" loading={add.isPending}>Add staff</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add list</DialogTitle><DialogDescription>Name, designation, email</DialogDescription></DialogHeader>
          <Field label="List" htmlFor="slist"><Textarea id="slist" value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-[13px]" placeholder={"Asha Verma, Maths teacher, asha@school.in\nRahul Soni, Peon, rahul@school.in"} /></Field>
          {parsed.length > 0 && <p className="text-sm text-muted-foreground">{valid.length}/{parsed.length} ready{parsed.some((p) => !p.ok) && <span className="text-danger"> · fix the rest</span>}</p>}
          <div className="flex items-center gap-3"><Checkbox id="sendlist" checked={sendNow} onCheckedChange={(v) => setSendNow(v === true)} /><Label htmlFor="sendlist">Send logins</Label></div>
          <Problem text={err} />
          <DialogFooter><Button variant="secondary" onClick={() => setListOpen(false)}>Cancel</Button><Button variant="brand" disabled={!valid.length || valid.length !== parsed.length} loading={bulk.isPending} onClick={addList}>Add {valid.length || ""} staff</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "edit"} onOpenChange={(o) => !o && close()}>
        <DialogContent>{sel && (<>
          <DialogHeader><DialogTitle>Edit staff</DialogTitle><DialogDescription>{sel.name}</DialogDescription></DialogHeader>
          <form key={sel.id} className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const s = (k: string) => String(f.get(k) ?? "").trim();
            setErr(null);
            edit.mutate({ id: sel.id, body: { name: s("name"), designation: s("designation"), department: s("department"), email: s("email"), phone: s("phone") || null } }, {
              onSuccess: () => { toast.success("Details saved"); close(); },
              onError: (x) => setErr(errorText(x)),
            });
          }}>
            <Field label="Name" htmlFor="en"><Input id="en" name="name" defaultValue={sel.name} required minLength={2} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Designation" htmlFor="ed"><Input id="ed" name="designation" defaultValue={sel.designation} required /></Field>
              <Field label="Department" htmlFor="ep"><Input id="ep" name="department" defaultValue={sel.department} /></Field>
              <Field label="Email" htmlFor="ee"><Input id="ee" name="email" type="email" defaultValue={sel.email} required /></Field>
              <Field label="Mobile" htmlFor="eph"><Input id="eph" name="phone" defaultValue={sel.phone ?? ""} /></Field>
            </div>
            <Problem text={err} />
            <DialogFooter><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" variant="brand" loading={edit.isPending}>Save</Button></DialogFooter>
          </form>
        </>)}</DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "perms"} onOpenChange={(o) => !o && close()}>
        <DialogContent>{sel && (<>
          <DialogHeader><DialogTitle>Access</DialogTitle><DialogDescription>{sel.name}</DialogDescription></DialogHeader>
          <ul className="flex flex-col gap-1">
            {PERMS.map((p) => {
              const on = sel.permissions.includes(p);
              return (
                <li key={p} className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
                  <Label htmlFor={p}>{PERMISSION_LABELS[p]}</Label>
                  <Switch id={p} checked={on} disabled={setPerms.isPending} onCheckedChange={(v) => {
                    setErr(null);
                    const next = (v ? [...sel.permissions, p] : sel.permissions.filter((x) => x !== p)) as Permission[];
                    setPerms.mutate({ id: sel.id, permissions: next }, { onSuccess: () => toast.success("Access updated"), onError: (x) => setErr(errorText(x)) });
                  }} />
                </li>
              );
            })}
          </ul>
          <Problem text={err} />
          <DialogFooter><Button variant="brand" onClick={close}>Done</Button></DialogFooter>
        </>)}</DialogContent>
      </Dialog>

      <Dialog open={mode?.kind === "remove"} onOpenChange={(o) => !o && close()}>
        <DialogContent>{sel && (<>
          <DialogHeader><DialogTitle>Remove staff?</DialogTitle><DialogDescription>{sel.name} loses access. Logged in audit.</DialogDescription></DialogHeader>
          <Problem text={err} />
          <DialogFooter>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button variant="brand" loading={remove.isPending} onClick={() => { setErr(null); remove.mutate(sel.id, { onSuccess: () => { toast.success(`${sel.name} removed`); close(); }, onError: (x) => setErr(errorText(x)) }); }}>Remove</Button>
          </DialogFooter>
        </>)}</DialogContent>
      </Dialog>
    </>
  );
}
