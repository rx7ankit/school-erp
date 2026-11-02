"use client";
import * as React from "react";
import { Check, FileCheck2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { LeaveStatusBadge, rangeLabel } from "@/components/app/leave/leave-bits";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchLeaveAttachment, useDecideLeave, useLeaveList, type LeaveOut } from "@/lib/api/hooks/leave";
import { errorText } from "@/lib/api/hooks/staff";
import type { LeaveHalf, LeaveStatus } from "@/lib/leave";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";

const range = (l: LeaveOut) => rangeLabel({ fromOn: l.from_on, toOn: l.to_on, half: l.half as LeaveHalf });
const badge = (l: LeaveOut) => <LeaveStatusBadge status={l.status as LeaveStatus} />;

/** Opens the attachment through a short-lived link from the API. The tab opens first so pop-up blockers allow it. */
function AttachmentButton({ id }: { id: string }) {
  const [busy, setBusy] = React.useState(false);
  async function open() {
    const w = window.open("", "_blank");
    setBusy(true);
    try { const r = await fetchLeaveAttachment(id); if (w) w.location.href = r.url; else window.location.href = r.url; }
    catch (e) { w?.close(); toast.error(errorText(e)); } finally { setBusy(false); }
  }
  return <Button variant="secondary" size="sm" loading={busy} onClick={open}>{!busy && <Paperclip />}Attachment</Button>;
}

function PendingCard({ leave }: { leave: LeaveOut }) {
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const decide = useDecideLeave();
  const act = (decision: "approve" | "reject") => {
    setErr(null);
    decide.mutate({ id: leave.id, decision, note }, {
      onSuccess: () => toast.success(decision === "approve" ? `Leave approved for ${leave.student_name}` : `Leave rejected for ${leave.student_name}`, { description: "The parent has been notified." }),
      onError: (e) => setErr(errorText(e)),
    });
  };
  const doing = decide.isPending ? decide.variables?.decision : null;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={leave.student_name} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{leave.student_name} <span className="font-normal text-text-tertiary">· {leave.class_label ? `Class ${leave.class_label}` : "No class"}</span></p>
          <p className="text-sm text-muted-foreground">{range(leave)}</p>
        </div>
        {badge(leave)}
      </div>
      <p className="whitespace-pre-wrap text-sm">{leave.reason}</p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-text-tertiary">Applied {formatIST(leave.created_at)} IST by {leave.guardian_name}</p>
        {leave.has_attachment && <AttachmentButton id={leave.id} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={`Note to ${leave.guardian_name} (optional)`} placeholder="Note to parent (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="min-w-48 flex-1" />
        <Button variant="secondary" loading={doing === "reject"} disabled={decide.isPending} onClick={() => act("reject")}>{doing !== "reject" && <X />}Reject</Button>
        <Button variant="brand" loading={doing === "approve"} disabled={decide.isPending} onClick={() => act("approve")}>{doing !== "approve" && <Check />}Approve</Button>
      </div>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
    </Card>
  );
}

const SIZE = 20;
function History() {
  const [status, setStatus] = React.useState("approved");
  const [page, setPage] = React.useState(0);
  const q = useLeaveList({ status, limit: SIZE, offset: page * SIZE });
  const total = q.data?.total ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <NativeSelect aria-label="Status" className="w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
        <option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled by parent</option>
      </NativeSelect>
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : total === 0 ? <EmptyState icon={FileCheck2} title="Nothing here yet" /> : (
        <Card className={cn(q.isPlaceholderData && "opacity-60")}>
          <Table className="min-w-[720px]">
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Dates</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Decided (IST)</TableHead></TableRow></TableHeader>
            <TableBody>{q.data?.items.map((l) => (
              <TableRow key={l.id}>
                <TableCell><div className="flex items-center gap-3"><Avatar name={l.student_name} /><div><p className="font-medium">{l.student_name}</p><p className="text-xs text-text-tertiary">{l.class_label ? `Class ${l.class_label}` : ""}</p></div></div></TableCell>
                <TableCell className="text-sm">{range(l)}</TableCell>
                <TableCell className="max-w-64 text-sm text-muted-foreground">{l.reason}{l.decision_note && <p className="mt-1 text-xs text-text-tertiary">Note: {l.decision_note}</p>}{l.has_attachment && <span className="mt-1 block"><AttachmentButton id={l.id} /></span>}</TableCell>
                <TableCell>{badge(l)}</TableCell>
                <TableCell className="text-xs text-text-tertiary">{l.decided_at ? <>{formatIST(l.decided_at, "short")}<br />{l.decided_by_name}</> : "—"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          {total > SIZE && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span className="tabular-nums">{page * SIZE + 1}–{Math.min(total, (page + 1) * SIZE)} of {total}</span>
              <span className="flex gap-2"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={(page + 1) * SIZE >= total} onClick={() => setPage(page + 1)}>Next</Button></span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/** Leave applications from parents, on the real API. The class teacher sees their own class, the admin sees all. */
export function LeaveLive() {
  const pending = useLeaveList({ status: "pending", limit: 200, offset: 0 });
  const [tab, setTab] = React.useState("pending");
  const items = React.useMemo(() => [...(pending.data?.items ?? [])].sort((a, b) => a.from_on.localeCompare(b.from_on)), [pending.data]);
  return (
    <>
      <PageHeader eyebrow="Class teacher" title="Leave requests." dim="Approve or reject." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="pending">Pending{pending.data ? ` (${pending.data.total})` : ""}</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
        <TabsContent value="pending" className="flex flex-col gap-4">
          {pending.isPending ? <LoadingBlock /> : pending.isError ? <ErrorBlock error={pending.error} onRetry={() => pending.refetch()} /> : items.length === 0
            ? <EmptyState icon={FileCheck2} title="No requests waiting" text="When a parent applies for leave, it shows up here and you can approve it." />
            : items.map((l) => <PendingCard key={l.id} leave={l} />)}
        </TabsContent>
        <TabsContent value="history"><History /></TabsContent>
      </Tabs>
    </>
  );
}
