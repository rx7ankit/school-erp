"use client";
import * as React from "react";
import { CalendarPlus, FileCheck2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { LeaveStatusBadge, useRangeLabel } from "@/components/app/leave/leave-bits";
import { useChild } from "@/components/parent-child";
import { Loaded, useErrText } from "@/components/parent/live-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { openLeaveAttachment, uploadLeaveAttachment, useApplyLeave, useCancelLeave, useParentLeaves, type ParentLeave } from "@/lib/api/hooks/parent";
import { useFmt } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";
import { useTodayIST } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const HALVES = ["none", "first", "second"] as const;
const REASON_MAX = 1000;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function ApplyDialog({ open, onOpenChange, sid, childName, todayOn }: { open: boolean; onOpenChange: (o: boolean) => void; sid: string; childName: string; todayOn: string }) {
  const t = useT(), errText = useErrText();
  const [fromOn, setFrom] = React.useState(todayOn);
  const [toOn, setTo] = React.useState(todayOn);
  const [half, setHalf] = React.useState<(typeof HALVES)[number]>("none");
  const [reason, setReason] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const apply = useApplyLeave(sid);
  const single = fromOn === toOn;

  function reset() { setFrom(todayOn); setTo(todayOn); setHalf("none"); setReason(""); setFile(null); setError(null); }
  function problem(): string | null {
    if (!fromOn || !toOn) return t("lve.dates");
    if (fromOn < todayOn) return t("lve.past");
    if (toOn < fromOn) return t("lve.order");
    if (!reason.trim()) return t("lve.reason");
    if (reason.length > REASON_MAX) return t("lve.long", { n: REASON_MAX });
    return null;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = problem();
    setError(p);
    if (p) return;
    setBusy(true);
    try {
      const attachment_id = file ? await uploadLeaveAttachment(file) : null;
      await apply.mutateAsync({ from_on: fromOn, to_on: toOn, half: single ? half : "none", reason: reason.trim(), attachment_id });
      toast.success(t("lvd.sent"));
      reset(); onOpenChange(false);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("lvd.title")}</DialogTitle><DialogDescription>{t("lvd.desc", { name: childName })}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("lvd.from")} htmlFor="lv-from"><Input id="lv-from" type="date" min={todayOn} value={fromOn} onChange={(e) => { setFrom(e.target.value); if (toOn < e.target.value) setTo(e.target.value); }} required /></Field>
            <Field label={t("lvd.to")} htmlFor="lv-to"><Input id="lv-to" type="date" min={fromOn || todayOn} value={toOn} onChange={(e) => setTo(e.target.value)} required /></Field>
          </div>
          <div className="flex flex-col gap-2">
            <span id="lv-half-l" className="text-sm font-medium">{t("lvd.part")}</span>
            <div role="radiogroup" aria-labelledby="lv-half-l" className="inline-flex gap-0.5 self-start rounded-full bg-fill p-[3px]">
              {HALVES.map((h) => {
                const on = (single ? half : "none") === h;
                return <button key={h} type="button" role="radio" aria-checked={on} disabled={!single && h !== "none"} onClick={() => setHalf(h)}
                  className={cn("h-8 rounded-full px-3 text-sm font-medium text-muted-foreground disabled:opacity-40", on && "bg-solid text-on-solid")}>{t(`lv.h.${h}`)}</button>;
              })}
            </div>
            {!single && <p className="text-xs text-text-tertiary">{t("lvd.single")}</p>}
          </div>
          <Field label={t("lvd.reason")} htmlFor="lv-reason">
            <Textarea id="lv-reason" value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} placeholder={t("lvd.placeholder")} required />
          </Field>
          <Field label={t("pl.attachOptional")}>
            <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-label={t("pl.attachOptional")}
              onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size > MAX_BYTES) { setError(t("pl.fileBig", { name: f.name })); } else if (f) { setFile(f); setError(null); } e.target.value = ""; }} />
            {file ? (
              <span className="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-fill py-1 pl-3 pr-1 text-xs"><Paperclip className="size-3.5 shrink-0" /><span className="max-w-56 truncate">{file.name}</span>
                <button type="button" aria-label={t("pl.removeFile")} onClick={() => setFile(null)} className="grid size-5 place-items-center rounded-full hover:bg-separator"><X className="size-3" /></button></span>
            ) : <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => input.current?.click()}><Paperclip /> {t("pl.attach")}</Button>}
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t("lvd.cancel")}</Button>
            <Button type="submit" variant="brand" loading={busy}>{t("lvd.send")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeaveRow({ l, readOnly, onCancel }: { l: ParentLeave; readOnly: boolean; onCancel: () => void }) {
  const t = useT(), f = useFmt(), rangeLabel = useRangeLabel(), err = useErrText();
  const status = l.status as "pending" | "approved" | "rejected" | "cancelled";
  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{rangeLabel({ fromOn: l.from_on, toOn: l.to_on, half: l.half as "none" | "first" | "second" })}</p>
        <LeaveStatusBadge status={status} />
      </div>
      <p className="whitespace-pre-line break-words text-sm">{l.reason}</p>
      {l.has_attachment && (
        <button type="button" onClick={() => openLeaveAttachment(l.id).catch((e) => toast.error(err(e)))} className="flex w-fit items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-xs hover:bg-separator"><Paperclip className="size-3.5" />{t("pl.viewNote")}</button>
      )}
      {l.decision_note && <p className="rounded-xl bg-fill px-3 py-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">{l.decided_by_name ?? t("lv.teacher")}:</span> {l.decision_note}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-tertiary">
        <span>{t("lv.applied", { date: f.ist(l.created_at) })}{l.decided_at && ` · ${t(status === "approved" ? "lv.approved" : "lv.decided", { date: f.ist(l.decided_at, "short") })}`}</span>
        {status === "pending" && !readOnly && <Button size="sm" variant="secondary" onClick={onCancel}>{t("lv.cancel")}</Button>}
      </div>
    </Card>
  );
}

export function LeaveLive() {
  const t = useT(), err = useErrText();
  const sel = useChild();
  const today = useTodayIST();
  const sid = sel?.child.id ?? "";
  const q = useParentLeaves(sid);
  const cancel = useCancelLeave(sid);
  const [open, setOpen] = React.useState(false);
  const [cancelId, setCancelId] = React.useState<string | null>(null);
  if (!sel || !today) return null;
  const { child } = sel;
  const left = child.readOnly, name = child.name.split(" ")[0];
  return (
    <>
      <PageHeader title={t("lv.title")}
        actions={<Button variant="brand" disabled={left} onClick={() => setOpen(true)}><CalendarPlus /> {t("lv.apply")}</Button>} />
      {left && <Card className="py-4 text-sm text-muted-foreground">{t("pl.leftNote", { name })}</Card>}
      <Loaded q={q}>
        {(page) => page.items.length === 0 ? <EmptyState icon={FileCheck2} title={t("lv.emptyTitle")} /> : (
          <ul className="flex flex-col gap-3">{page.items.map((l) => <li key={l.id}><LeaveRow l={l} readOnly={left} onCancel={() => setCancelId(l.id)} /></li>)}</ul>
        )}
      </Loaded>
      <ApplyDialog open={open} onOpenChange={setOpen} sid={sid} childName={name} todayOn={today} />
      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("lv.cancelTitle")}</DialogTitle><DialogDescription className="sr-only">{t("lv.cancelText")}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelId(null)}>{t("lv.keep")}</Button>
            <Button variant="destructive" loading={cancel.isPending} onClick={() => cancelId && cancel.mutate(cancelId, { onSuccess: () => { toast.success(t("lv.cancelled")); setCancelId(null); }, onError: (e) => { toast.error(err(e)); setCancelId(null); } })}>{t("lv.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
