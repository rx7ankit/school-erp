"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { useCan } from "@/components/app/can";
import { CertificatesTab } from "@/components/app/student/certificates-tab";
import { DetailsTab } from "@/components/app/student/details-tab";
import { DocumentsTab } from "@/components/app/student/documents-tab";
import { GuardiansTab } from "@/components/app/student/guardians-tab";
import { LeaveDialog } from "@/components/app/student/leave-dialog";
import { OverviewTab } from "@/components/app/student/overview-tab";
import { StudentPhoto } from "@/components/app/student/student-photo";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STUDENTS, className, type Student } from "@/lib/mock";
import { applyLifecycle, rejoin, useStudentRecord } from "@/lib/student-record";
import { formatDateOn } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

export default function StudentProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const original = STUDENTS.find((s) => s.id === id);
  const record = useStudentRecord(id);
  const [open, setOpen] = React.useState(false);
  const today = useTodayIST();
  const { user } = useSession();
  const can = useCan();
  if (!original) return <p className="text-muted-foreground">Student not found.</p>;

  const manager = can("academic.manage");
  const s: Student = applyLifecycle(original);
  const left = s.status !== "active";

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link href="/students"><ArrowLeft /> Students</Link></Button>
      <PageHeader eyebrow={`${s.scholarNo} · Class ${className(s.classId)} · Roll ${s.rollNo}`} title={`${s.name}.`} dim={left ? "Left school." : "Active student."}
        actions={manager && (left
          ? <Button variant="secondary" onClick={() => { rejoin(s); toast.success(`${s.name} is active again`); }}><RotateCcw /> Rejoin</Button>
          : <Button variant="secondary" onClick={() => setOpen(true)}><LogOut /> Mark as left</Button>)} />

      {left && (
        <Card className="flex flex-wrap items-center gap-3 bg-accent-subtle">
          <Badge tone="danger">Left school</Badge>
          <p className="text-sm">On {formatDateOn(s.leftOn!)}. {s.leavingReason}. {s.tcNumber && <>Transfer certificate {s.tcNumber}.</>} Attendance and new fees have stopped. The parent can still read past records.</p>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <div className="flex flex-wrap items-center gap-4">
          <StudentPhoto name={s.name} url={record.photoUrl} className="size-10" />
          <TabsList aria-label="Student record">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="guardians">Guardians</TabsTrigger>
            {manager && <TabsTrigger value="documents">Documents</TabsTrigger>}
            {manager && <TabsTrigger value="certificates">Certificates</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="overview"><OverviewTab student={s} original={original} record={record} /></TabsContent>
        <TabsContent value="details"><DetailsTab key={id} studentId={id} name={s.name} record={record} canEdit={manager} /></TabsContent>
        <TabsContent value="guardians"><GuardiansTab student={s} record={record} canEdit={manager} /></TabsContent>
        {manager && <TabsContent value="documents"><DocumentsTab studentId={id} record={record} by={user?.name ?? "Staff"} /></TabsContent>}
        {manager && <TabsContent value="certificates"><CertificatesTab student={s} record={record} by={user?.name ?? "Staff"} /></TabsContent>}
      </Tabs>

      {manager && <LeaveDialog student={s} open={open} onOpenChange={setOpen} today={today} by={user?.name ?? "Staff"} />}
    </>
  );
}
