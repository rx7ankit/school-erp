"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, Pause, Play, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Appear, SkCard, SkHeader, SkList, SkPage, SkStat, SkStatGrid, SkTableRows, Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { useCreateSchool, useOwnerSchool, useOwnerSchools, useOwnerStats, useResendAdminLogin, useSetSchoolStatus } from "@/lib/api/hooks/owner";
import type { SchoolOut } from "@/lib/api/types";
import { formatINR, formatIST } from "@/lib/time";
import { InvoicesSection, PriceCard } from "@/components/app/owner-live-billing";

const TONE: Record<string, "success" | "warning" | "danger"> = { active: "success", suspended: "danger" };
const statusBadge = (s: string) => <Badge tone={TONE[s] ?? "warning"} className="capitalize">{s}</Badge>;
const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");

function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 text-sm text-destructive"><span>{msg(error)}</span>{retry && <Button size="sm" variant="secondary" onClick={retry}>Retry</Button>}</div>;
}

/* ---------- schools list ---------- */
export function LiveSchools() {
  const q = useOwnerSchools();
  const create = useCreateSchool();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const all = q.data?.items ?? [];
  const term = search.trim().toLowerCase();
  const rows = all.filter((s) => (status === "all" || s.status === status) && (!term || [s.name, s.city, s.admin_name, s.admin_email].some((v) => v?.toLowerCase().includes(term))));
  const fields = create.error instanceof ApiError ? create.error.fields : {};

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({ name: String(f.get("name")).trim(), city: String(f.get("city")).trim(), admin_name: String(f.get("admin")).trim(), admin_email: String(f.get("email")).trim(), status: "active" }, {
      onSuccess: (s) => { setOpen(false); toast.success(`${s.name} added`); },
    });
  }
  const err = (k: string) => fields[k] ? <p className="text-xs text-destructive">{fields[k]}</p> : null;

  return (
    <>
      <PageHeader title="Schools." actions={<Button variant="accent" onClick={() => { create.reset(); setOpen(true); }}><Plus /> Add</Button>} />
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" /><Input aria-label="Search schools" placeholder="Search" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="flex gap-1">{["all", "active", "suspended"].map((s) => <Button key={s} size="sm" variant={status === s ? "default" : "secondary"} className="capitalize" onClick={() => setStatus(s)}>{s}</Button>)}</div>
      </div>
      {q.isPending ? (
        <SkPage label="Loading">
          <Card>
            <Table className="min-w-[820px]">
              <TableHeader><TableRow><TableHead>School</TableHead><TableHead>Admin</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Monthly</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
              <TableBody><SkTableRows rows={6} cols={6} /></TableBody>
            </Table>
          </Card>
        </SkPage>
      ) : q.isError ? <ErrorNote error={q.error} retry={() => q.refetch()} /> : (
        <Appear><Card>
          <Table className="min-w-[820px]">
            <TableHeader><TableRow><TableHead>School</TableHead><TableHead>Admin</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Monthly</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{all.length ? "No schools." : "No schools."}</TableCell></TableRow>}
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><Link href={`/owner/schools/${s.id}`} className="font-medium hover:underline">{s.name}</Link><p className="text-xs text-text-tertiary">{s.city}</p></TableCell>
                  <TableCell><p>{s.admin_name ?? "—"}</p><p className="text-xs text-text-tertiary">{s.admin_email}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{s.active_students.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.monthly_paise ? formatINR(s.monthly_paise) : "—"}</TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{formatIST(s.created_at, "date")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card></Appear>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add school</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Name" htmlFor="name"><Input id="name" name="name" required />{err("name")}</Field>
            <Field label="City" htmlFor="city"><Input id="city" name="city" required />{err("city")}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Admin" htmlFor="admin"><Input id="admin" name="admin" required />{err("admin_name")}</Field>
              <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required />{err("admin_email")}</Field>
            </div>
            {create.isError && !Object.keys(fields).length && <p className="text-sm text-destructive">{msg(create.error)}</p>}
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="brand" loading={create.isPending}>Create</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- school detail ---------- */
const LOGIN: Record<string, string> = { logged_in: "Logged in", pending: "Not yet", sent: "Email sent", expired: "Link expired" };

export function LiveSchool({ id }: { id: string }) {
  const q = useOwnerSchool(id);
  const setStatus = useSetSchoolStatus(id);
  const resend = useResendAdminLogin(id);
  const [confirm, setConfirm] = React.useState(false);
  if (q.isPending) return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link href="/owner/schools"><ArrowLeft /> Schools</Link></Button>
      <SkPage label="Loading">
        <SkHeader actions={3} />
        <SkStatGrid count={4} />
        <Card>
          <div className="mb-6"><Skeleton className="h-5 w-20" /></div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-3">
            {Array.from({ length: 5 }, (_, i) => <React.Fragment key={i}><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-48" /></React.Fragment>)}
          </dl>
        </Card>
        <SkCard height={160} />
      </SkPage>
    </>
  );
  if (q.isError) return <ErrorNote error={q.error} retry={() => q.refetch()} />;
  const s: SchoolOut = q.data;
  const loginTone = s.admin_login_status === "logged_in" ? "success" : "warning";

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link href="/owner/schools"><ArrowLeft /> Schools</Link></Button>
      <Appear><PageHeader title={`${s.name}.`}
        actions={<>
          <PriceCard school={s} />
          <Button variant="secondary" loading={resend.isPending} disabled={!s.admin_email} onClick={() => resend.mutate(undefined, { onSuccess: (r) => r.sent ? toast.success("Login sent") : toast.error("Could not send"), onError: (e) => toast.error(msg(e)) })}><Mail /> Resend login</Button>
          {s.status === "suspended"
            ? <Button variant="brand" loading={setStatus.isPending} onClick={() => setStatus.mutate("active", { onSuccess: () => toast.success("School reactivated"), onError: (e) => toast.error(msg(e)) })}><Play /> Reactivate</Button>
            : <Button variant="secondary" onClick={() => setConfirm(true)}><Pause /> Suspend</Button>}
        </>} /></Appear>
      <Appear i={1} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={s.active_students.toLocaleString("en-IN")} />
        <StatCard label="Per student" value={formatINR(s.price_per_student_paise)} />
        <StatCard label="Monthly" value={s.monthly_paise ? formatINR(s.monthly_paise) : "—"} />
        <StatCard label="Status" value={statusBadge(s.status)} />
      </Appear>
      <Appear i={2}><Card>
        <CardHeader><CardTitle>Admin</CardTitle></CardHeader>
        <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
          <dt className="text-muted-foreground">Name</dt><dd className="font-medium">{s.admin_name ?? "—"}</dd>
          <dt className="text-muted-foreground">Email</dt><dd className="break-words font-medium">{s.admin_email ?? "—"}</dd>
          <dt className="text-muted-foreground">Login</dt><dd>{s.admin_login_status ? <Badge tone={loginTone}>{LOGIN[s.admin_login_status] ?? s.admin_login_status}</Badge> : "—"}</dd>
          <dt className="text-muted-foreground">Last login</dt><dd className="tabular-nums">{s.admin_last_login_at ? `${formatIST(s.admin_last_login_at)} IST` : "—"}</dd>
          <dt className="text-muted-foreground">Joined</dt><dd className="tabular-nums">{formatIST(s.created_at)} IST</dd>
        </dl>
      </Card></Appear>
      <InvoicesSection schoolId={s.id} title="Invoices" />
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suspend {s.name}?</DialogTitle><DialogDescription>Blocks all logins. Nothing is deleted.</DialogDescription></DialogHeader>
          {setStatus.isError && <p className="text-sm text-destructive">{msg(setStatus.error)}</p>}
          <DialogFooter><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="destructive" loading={setStatus.isPending} onClick={() => setStatus.mutate("suspended", { onSuccess: () => { setConfirm(false); toast.success("School suspended"); } })}>Suspend</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- overview ---------- */
export function LiveOverview() {
  const st = useOwnerStats();
  const sc = useOwnerSchools();
  const newest = (sc.data?.items ?? []).slice(0, 4);
  return (
    <>
      <PageHeader title="Overview." />
      {st.isError ? <ErrorNote error={st.error} retry={() => st.refetch()} /> : st.isPending ? (
        <SkPage label="Loading">
          <SkStatGrid count={4} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><SkStat /><SkStat /><SkStat /></div>
          <Card className="flex flex-col gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-12" /><Skeleton className="h-4 w-20" /></Card>
        </SkPage>
      ) : (
        <>
          <Appear className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Schools" value={st.data.schools} />
            <StatCard label="Students" value={st.data.active_students.toLocaleString("en-IN")} />
            <StatCard label="Monthly" value={formatINR(st.data.mrr_paise)} />
            <StatCard label="Yearly" value={formatINR(st.data.arr_paise)} />
          </Appear>
          <Appear i={1} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Collected" value={formatINR(st.data.collected_paise)} />
            <StatCard label="Due" value={formatINR(st.data.due_paise)} />
            <StatCard label="Overdue" value={formatINR(st.data.overdue_paise)} />
          </Appear>
          <Appear i={2}><Card className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.06em] text-text-tertiary">New this month</p>
            <p className="text-[28px] font-bold tabular-nums">{st.data.new_schools_this_month}</p>
            <Link href="/owner/revenue" className="flex items-center gap-1 text-sm font-medium text-foreground">Revenue <ArrowRight className="size-4" /></Link>
          </Card></Appear>
        </>
      )}
      <Card>
        <CardHeader><CardTitle>Newest schools</CardTitle><Link href="/owner/schools" className="text-sm font-medium text-foreground">All</Link></CardHeader>
        {sc.isPending ? <SkList rows={4} avatar={false} /> : sc.isError ? <ErrorNote error={sc.error} retry={() => sc.refetch()} /> : (
          <Appear as="ul">
            {newest.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1"><Link href={`/owner/schools/${s.id}`} className="font-medium hover:underline">{s.name}</Link><p className="text-xs text-text-tertiary">{s.city}</p></div>
                <span className="text-sm tabular-nums text-muted-foreground">{s.active_students}</span>
                {statusBadge(s.status)}
              </li>
            ))}
            {newest.length === 0 && <li className="text-sm text-muted-foreground">No schools.</li>}
          </Appear>
        )}
      </Card>
    </>
  );
}

/* ---------- billing: plain. Students, what they come to, invoices you can download as PDF ---------- */
export function LiveRevenue() {
  const st = useOwnerStats();
  return (
    <>
      <PageHeader title="Billing." />
      {st.isError ? <ErrorNote error={st.error} retry={() => st.refetch()} /> : st.isPending ? <SkPage label="Loading"><SkStatGrid count={4} /></SkPage> : (
        <Appear className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Schools" value={st.data.schools_active} />
          <StatCard label="Students" value={st.data.active_students.toLocaleString("en-IN")} />
          <StatCard label="Monthly" value={formatINR(st.data.mrr_paise)} />
          <StatCard label="Yearly" value={formatINR(st.data.arr_paise)} />
        </Appear>
      )}
      <InvoicesSection />
    </>
  );
}
