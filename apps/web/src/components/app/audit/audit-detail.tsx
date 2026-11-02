"use client";
import * as React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORY_LABEL, type AuditEvent } from "@/lib/audit";
import { formatIST } from "@/lib/time";

/** Everything known about one event. Changes are shown as before and after. */
export function AuditDetail({ event, onClose }: { event: AuditEvent | null; onClose: () => void }) {
  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {event && (<>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{event.sensitive && <ShieldAlert className="size-5 text-danger" aria-label="Sensitive" />}{CATEGORY_LABEL[event.category]}</DialogTitle>
            <DialogDescription>{event.summary}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
            <dt className="text-muted-foreground">When</dt><dd className="font-medium tabular-nums">{formatIST(event.at)} IST</dd>
            <dt className="text-muted-foreground">Who</dt><dd className="flex items-center gap-2 font-medium"><Avatar name={event.actorName} className="size-6 text-[10px]" />{event.actorName}<span className="font-normal text-text-tertiary">{event.actorRole}</span></dd>
            <dt className="text-muted-foreground">Action</dt><dd><code className="rounded-md bg-fill px-1.5 py-0.5 text-xs">{event.action}</code></dd>
            {event.entity && (<><dt className="text-muted-foreground">About</dt><dd className="font-medium">{event.href ? <Link href={event.href} className="text-foreground hover:underline">{event.entity}</Link> : event.entity}</dd></>)}
            {event.sensitive && (<><dt className="text-muted-foreground">Flag</dt><dd><Badge tone="danger">Sensitive</Badge></dd></>)}
            <dt className="text-muted-foreground">ID</dt><dd className="break-all text-xs text-text-tertiary">{event.id}</dd>
          </dl>
          {event.changes && event.changes.length > 0 && (
            <div className="rounded-xl bg-fill p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Changes</p>
              <ul className="flex flex-col gap-2 text-sm">
                {event.changes.map((c) => (
                  <li key={c.field} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className="col-span-3 text-muted-foreground">{c.field}</span>
                    <span className="rounded-lg bg-background px-2.5 py-1.5 text-text-tertiary line-through">{c.from || "—"}</span>
                    <span aria-hidden>→</span>
                    <span className="rounded-lg bg-background px-2.5 py-1.5 font-medium">{c.to || "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>)}
      </DialogContent>
    </Dialog>
  );
}
