"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, LogOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/components/app/can";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { ClassSelect, Problem } from "@/components/app/school-bits";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { CertificatesLive } from "@/components/app/certificates-live";
import { STATUS_LABEL, statusTone } from "@/components/app/students-live";
import { DetailsTabLive, DocumentsTabLive, GuardiansTabLive, PhotoPicker } from "@/components/app/student-live-tabs";
import { StudentPhoto } from "@/components/app/student/student-photo";
import { Timeline, type TimelineItem } from "@/components/app/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { errorText } from "@/lib/api/hooks/staff";
import { useLeave, useRejoin, useStudent, useTransfer, type EventOut, type StudentDetail } from "@/lib/api/hooks/students";
import { formatDateOn, formatIST } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const EVENT_LABEL: Record<string, string> = {
  admitted: "Admitted", promoted: "Promoted", detained: "Kept back", class_changed: "Class changed", transferred: "Class changed",
  left: "Left", tc_issued: "TC issued", rejoined: "Rejoined", passed_out: "Passed out",
};
const human = (k: string) => EVENT_LABEL[k] ?? k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function eventItem(e: EventOut): TimelineItem {
  const move = e.from_class && e.to_class ? `${e.from_class} to ${e.to_class}` : e.to_class ? `Class ${e.to_class}` : e.from_class ? `From class ${e.from_class}` : "";
  const detail = [move, e.reason].filter(Boolean).join(". ");
  return {
    id: e.id, title: human(e.kind), detail: detail || undefined, tone: e.kind === "left" || e.kind === "tc_issued" ? "danger" : e.kind === "admitted" || e.kind === "rejoined" ? "brand" : "neutral",
    when: `${e.effective_on ? `${formatDateOn(e.effective_on)} · ` : ""}recorded ${formatIST(e.recorded_at)} IST${e.recorded_by_name ? ` by ${e.recorded_by_name}` : ""}`,
  };
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{k}</dt><dd className="mt-1 break-words text-sm">{v || <span className="text-text-tertiary">—</span>}</dd></div>)}
    </dl>
  );
}

function Overview({ s }: { s: StudentDetail }) {
  const cur = s.current_enrollment;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
        <Facts rows={[
          ["Class", cur ? `${cur.class_label}${cur.roll_no ? ` · Roll ${cur.roll_no}` : ""}` : null], ["Year", cur?.academic_year ?? null], ["Admitted", s.admitted_on ? formatDateOn(s.admitted_on) : null],
          ["Born", s.dob ? formatDateOn(s.dob) : null], ["Gender", s.gender ? s.gender[0].toUpperCase() + s.gender.slice(1) : null], ["Guardian", s.guardians.find((g) => g.is_primary)?.name ?? s.guardians[0]?.name ?? null],
        ]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Classes</CardTitle></CardHeader>
          {s.enrollments.length === 0 ? <p className="text-sm text-muted-foreground">No class yet.</p> : (
            <ul className="flex flex-col">
              {s.enrollments.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-border py-2.5 text-sm first:border-t-0 first:pt-0">
                  <span><b>{e.academic_year}</b> · Class {e.class_label}{e.roll_no ? ` · Roll ${e.roll_no}` : ""}</span>
                  <span className="capitalize text-muted-foreground">{e.status.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          {s.history.length === 0 ? <p className="text-sm text-muted-foreground">No history.</p> : <Timeline items={s.history.map(eventItem)} />}
        </Card>
      </div>
    </div>
  );
}

type Action = "leave" | "rejoin" | "transfer" | null;

function ActionDialog({ s, action, onClose }: { s: StudentDetail; action: Action; onClose: () => void }) {
  return <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}><DialogContent>{action && <ActionForm key={action} s={s} action={action} onClose={onClose} />}</DialogContent></Dialog>;
}

function ActionForm({ s, action, onClose }: { s: StudentDetail; action: NonNullable<Action>; onClose: () => void }) {
  const today = useTodayIST();
  const leave = useLeave(), rejoin = useRejoin(), transfer = useTransfer();
  const [cls, setCls] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const busy = leave.isPending || rejoin.isPending || transfer.isPending;
  const done = (msg: string) => ({ onSuccess: () => { toast.success(msg); onClose(); }, onError: (e: unknown) => setErr(errorText(e)) });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const reason = String(f.get("reason") ?? "").trim(), on = String(f.get("on") ?? "");
    if (action === "leave") leave.mutate({ id: s.id, reason, left_on: on || undefined }, done(`${s.name} marked as left`));
    else if (!cls) setErr("Choose a class.");
    else if (action === "rejoin") rejoin.mutate({ id: s.id, class_id: cls, reason, on: on || undefined }, done(`${s.name} is active again`));
    else if (action === "transfer") transfer.mutate({ id: s.id, class_id: cls, reason, effective_on: on || undefined }, done(`${s.name} moved`));
  }
  const title = action === "leave" ? "Mark left" : action === "rejoin" ? "Rejoin" : "Change class";
  const text = `${s.name}${s.current_enrollment ? `, ${s.current_enrollment.class_label}` : ""}`;
  return (
    <>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{text}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {action !== "leave" && <Field label={action === "rejoin" ? "Class" : "New class"} htmlFor="cls"><ClassSelect id="cls" value={cls} onChange={setCls} /></Field>}
          <Field label={action === "leave" ? "Last day" : "From"} htmlFor="on"><Input id="on" name="on" type="date" defaultValue={today ?? ""} /></Field>
          <Field label={action === "leave" ? "Reason" : "Reason"} htmlFor="reason"><Input id="reason" name="reason" required={action === "leave"}  /></Field>
          <Problem text={err} />
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant={action === "leave" ? "destructive" : "brand"} loading={busy}>{action === "leave" ? "Mark left" : action === "rejoin" ? "Rejoin" : "Move"}</Button></DialogFooter>
        </form>
    </>
  );
}

/** One student on the real API: overview and history, details, guardians, documents, and leave / rejoin / transfer. */
export function StudentLive({ id }: { id: string }) {
  const q = useStudent(id);
  const can = useCan();
  const manager = can("academic.manage");
  const [action, setAction] = React.useState<Action>(null);

  const back = <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link href="/students"><ArrowLeft /> Students</Link></Button>;
  if (q.isPending) return <>{back}<LoadingBlock label="Loading" /></>;
  if (q.isError) {
    const gone = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    return <>{back}<ErrorBlock error={gone ? new ApiError(404, "gone", "Student not found.") : q.error} onRetry={gone ? undefined : () => q.refetch()} /></>;
  }
  const s = q.data;
  const left = s.status !== "active";
  const cur = s.current_enrollment;
  return (
    <>
      {back}
      <PageHeader title={s.name}
        actions={manager && (left
          ? <Button variant="secondary" onClick={() => setAction("rejoin")}><RotateCcw /> Rejoin</Button>
          : <><Button variant="secondary" onClick={() => setAction("transfer")}><ArrowRightLeft /> Change class</Button><Button variant="secondary" onClick={() => setAction("leave")}><LogOut /> Mark left</Button></>)} />
      {left && (
        <Card className="flex flex-wrap items-center gap-3">
          <Badge tone={statusTone(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
          <p className="text-sm">{[s.left_on ? formatDateOn(s.left_on) : "", s.leaving_reason, s.tc_number ? `TC ${s.tc_number}` : ""].filter(Boolean).join(" · ")}</p>
        </Card>
      )}
      <p className="-mt-3 text-sm text-muted-foreground">{s.scholar_no}{cur ? ` · ${cur.class_label}${cur.roll_no ? ` · Roll ${cur.roll_no}` : ""}` : ""}</p>
      <Tabs defaultValue="overview">
        <div className="flex flex-wrap items-center gap-4">
          {manager ? <PhotoPicker s={s} /> : <StudentPhoto name={s.name} url={s.photo_url ?? undefined} className="size-10" />}
          <TabsList aria-label="Student record">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="guardians">Guardians</TabsTrigger>
            {manager && <TabsTrigger value="documents">Documents</TabsTrigger>}
            {manager && <TabsTrigger value="certificates">Certificates</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="overview"><Overview s={s} /></TabsContent>
        <TabsContent value="details"><DetailsTabLive key={`${s.id}-${s.history.length}`} s={s} canEdit={manager} /></TabsContent>
        <TabsContent value="guardians"><GuardiansTabLive s={s} canEdit={manager} /></TabsContent>
        {manager && <TabsContent value="documents"><DocumentsTabLive id={s.id} /></TabsContent>}
        {manager && <TabsContent value="certificates"><CertificatesLive studentId={s.id} studentName={s.name} status={s.status} /></TabsContent>}
      </Tabs>
      {manager && <ActionDialog s={s} action={action} onClose={() => setAction(null)} />}
    </>
  );
}
