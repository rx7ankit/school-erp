"use client";
import * as React from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { useCan } from "@/components/app/can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePending } from "@/lib/use-pending";
import { CLASSES, NEXT_YEAR, SCHOOL, STUDENTS, className } from "@/lib/mock";

type Decision = "promote" | "detain" | "leave" | "pass_out";
const nextOf = (classId: string) => {
  const c = CLASSES.find((x) => x.id === classId)!;
  return Number(c.grade) >= 10 ? "pass_out" : `${Number(c.grade) + 1}-${c.section}`;
};

export default function PromotionPage() {
  const can = useCan();
  const active = STUDENTS.filter((s) => s.status === "active");
  const [decision, setDecision] = React.useState<Record<string, Decision>>({});
  const [applied, setApplied] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const { run, is } = usePending(1200);
  const [classId, setClassId] = React.useState<string>(CLASSES[0].id);
  if (!can("academic.manage")) return <NoAccess need="the Academic permission" />;

  const get = (id: string, cls: string): Decision => decision[id] ?? (nextOf(cls) === "pass_out" ? "pass_out" : "promote");
  const counts = active.reduce((a, s) => { const d = get(s.id, s.classId); a[d] = (a[d] ?? 0) + 1; return a; }, {} as Record<Decision, number>);
  const rows = active.filter((s) => s.classId === classId);

  return (
    <>
      <PageHeader eyebrow={`${SCHOOL.year} → ${NEXT_YEAR}`} title="Promotion." dim="Move the whole school up, then fix exceptions." />
      {applied ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <h2 className="text-xl font-bold">Promotion applied for {NEXT_YEAR}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{counts.promote ?? 0} promoted, {counts.detain ?? 0} kept in class, {counts.pass_out ?? 0} passed out, {counts.leave ?? 0} left. Every change is in each student&apos;s history.</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{counts.promote ?? 0} promote</Badge>
            <Badge tone="warning">{counts.detain ?? 0} detain</Badge>
            <Badge tone="brand">{counts.pass_out ?? 0} pass out</Badge>
            <Badge tone="danger">{counts.leave ?? 0} leaving</Badge>
            <Button variant="brand" className="ml-auto" onClick={() => setConfirm(true)}>Review and apply</Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Class {className(classId)}</CardTitle>
              <NativeSelect aria-label="Class" className="w-40" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {CLASSES.map((c) => <option key={c.id} value={c.id}>Class {className(c.id)}</option>)}
              </NativeSelect>
            </CardHeader>
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Next year</TableHead><TableHead className="w-48">Decision</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const d = get(s.id, s.classId);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {d === "promote" && <span className="flex items-center gap-1.5">{className(s.classId)} <ArrowRight className="size-3.5" /> {nextOf(s.classId)}</span>}
                        {d === "detain" && <>Stays in {className(s.classId)}</>}
                        {d === "pass_out" && <>Passed out</>}
                        {d === "leave" && <>Not continuing</>}
                      </TableCell>
                      <TableCell>
                        <NativeSelect aria-label={`Decision for ${s.name}`} value={d} onChange={(e) => setDecision((m) => ({ ...m, [s.id]: e.target.value as Decision }))}>
                          {nextOf(s.classId) === "pass_out" ? <option value="pass_out">Pass out</option> : <option value="promote">Promote</option>}
                          <option value="detain">Keep in class</option><option value="leave">Leaving school</option>
                        </NativeSelect>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply promotion for {NEXT_YEAR}?</DialogTitle>
            <DialogDescription>New class lists are created and each student&apos;s history is updated. This can be applied once.</DialogDescription></DialogHeader>
          <ul className="flex flex-col gap-1 text-sm">
            <li className="flex justify-between rounded-xl bg-card px-4 py-3"><span>Promote</span><b>{counts.promote ?? 0}</b></li>
            <li className="flex justify-between rounded-xl bg-card px-4 py-3"><span>Keep in same class</span><b>{counts.detain ?? 0}</b></li>
            <li className="flex justify-between rounded-xl bg-card px-4 py-3"><span>Pass out</span><b>{counts.pass_out ?? 0}</b></li>
            <li className="flex justify-between rounded-xl bg-card px-4 py-3"><span>Leaving school</span><b>{counts.leave ?? 0}</b></li>
          </ul>
          <DialogFooter><Button variant="secondary" onClick={() => setConfirm(false)}>Back</Button><Button variant="brand" loading={is("apply")} onClick={() => run("apply", () => { setApplied(true); setConfirm(false); toast.success("Promotion applied"); })}>Apply promotion</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
