"use client";
import * as React from "react";
import { FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { EmptyState } from "@/components/app/empty-state";
import { ExportButton } from "@/components/app/export-button";
import { Pager, usePaged } from "@/components/app/pager";
import { PendingLeaveCard } from "@/components/app/leave/pending-card";
import { LeaveStatusBadge, rangeLabel, statusLabel } from "@/components/app/leave/leave-bits";
import { useSession } from "@/components/session-provider";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeaves } from "@/lib/leave";
import { CLASSES, STUDENTS, className } from "@/lib/mock";
import { classIdsFor, hasAccess } from "@/lib/permissions";
import { formatIST } from "@/lib/time";
import { isLive } from "@/lib/api/config";
import { LeaveLive } from "@/components/app/leave-live";

function LeaveDemo() {
  const { user } = useSession();
  const leaves = useLeaves();
  const [tab, setTab] = React.useState("pending");
  const mine = user ? classIdsFor(user, "class_teacher", CLASSES.map((c) => c.id)) : [];
  const rows = leaves.filter((l) => { const s = STUDENTS.find((x) => x.id === l.studentId); return !!s && mine.includes(s.classId); });
  const pending = rows.filter((l) => l.status === "pending").sort((a, b) => a.fromOn.localeCompare(b.fromOn));
  const history = rows.filter((l) => l.status !== "pending");
  const paged = usePaged(history, 10);
  if (!user || !hasAccess(user, "class_teacher")) return <NoAccess need="class teacher access" />;

  return (
    <>
      <PageHeader title="Leave."
        actions={<ExportButton fileName="leave-requests" build={() => [{ name: "Leave", headers: ["Student", "Class", "From", "To", "Part of day", "Reason", "Status", "Applied (IST)", "Decided by", "Note"],
          rows: rows.map((l) => { const s = STUDENTS.find((x) => x.id === l.studentId)!; return [s.name, className(s.classId), l.fromOn, l.toOn, l.half === "none" ? "Full day" : l.half === "first" ? "First half" : "Second half", l.reason, statusLabel(l.status), formatIST(l.createdAt), l.decidedBy ?? "", l.note ?? ""]; }) }]} />} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
        <TabsContent value="pending" className="flex flex-col gap-4">
          {pending.length === 0
            ? <EmptyState icon={FileCheck2} title="No requests" />
            : pending.map((l) => <PendingLeaveCard key={l.id} leave={l} by={user.name} />)}
        </TabsContent>
        <TabsContent value="history">
          {history.length === 0 ? <EmptyState icon={FileCheck2} title="No history" /> : (
            <Card>
              <Table className="min-w-[720px]">
                <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Dates</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Decided</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paged.rows.map((l) => { const s = STUDENTS.find((x) => x.id === l.studentId)!; return (
                    <TableRow key={l.id}>
                      <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><div><p className="font-medium">{s.name}</p><p className="text-xs text-text-tertiary">Class {className(s.classId)}</p></div></div></TableCell>
                      <TableCell className="text-sm">{rangeLabel(l)}</TableCell>
                      <TableCell className="max-w-64 text-sm text-muted-foreground">{l.reason}{l.note && <p className="mt-1 text-xs text-text-tertiary">Note: {l.note}</p>}</TableCell>
                      <TableCell><LeaveStatusBadge status={l.status} /></TableCell>
                      <TableCell className="text-xs text-text-tertiary">{l.decidedAt ? <>{formatIST(l.decidedAt, "short")}<br />{l.decidedBy}</> : "—"}</TableCell>
                    </TableRow>
                  ); })}
                </TableBody>
              </Table>
              <Pager {...paged} />
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function LeavePage() {
  const { user } = useSession();
  if (!isLive) return <LeaveDemo />;
  if (!user || !hasAccess(user, "class_teacher")) return <NoAccess need="class teacher access" />;
  return <LeaveLive />;
}
