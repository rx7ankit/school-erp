"use client";
import * as React from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/academic/confirm-dialog";
import { Field } from "@/components/app/field";
import { MAX_FILES, PickedFiles, uploadAll, useAttachments } from "@/components/app/messages-live-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useAttachmentUrl, useDeleteBroadcast, useEditBroadcast } from "@/lib/api/hooks/messaging";
import { errorText } from "@/lib/api/hooks/staff";
import type { AttachmentRef, BroadcastOut } from "@/lib/api/types";

export const isImage = (a: AttachmentRef) => a.content_type.startsWith("image/");

/** An image attachment shown from its short-lived signed link. */
export function AttachmentImage({ a, className }: { a: AttachmentRef; className?: string }) {
  const q = useAttachmentUrl(a.id);
  if (!q.data) return <div className={`${className ?? ""} bg-fill ${q.isError ? "" : "animate-pulse"}`} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={q.data.url} alt={a.filename} loading="lazy" className={className} />;
}

/** Edit a sent notice: title, text, and its photos/files. Mounted only while open so the fields start from the notice. */
function EditBody({ b, onClose }: { b: BroadcastOut; onClose: () => void }) {
  const edit = useEditBroadcast();
  const att = useAttachments();
  const [title, setTitle] = React.useState(b.title);
  const [body, setBody] = React.useState(b.body);
  const [kept, setKept] = React.useState<AttachmentRef[]>(b.attachments);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const fields = error instanceof ApiError ? error.fields : {};
  const total = kept.length + att.files.length;
  const disabled = !title.trim() || !body.trim() || total > MAX_FILES;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setError(null); setBusy(true);
    try {
      const added = await uploadAll(att.files);
      await edit.mutateAsync({ id: b.id, patch: { title: title.trim(), body: body.trim(), attachment_ids: [...kept.map((a) => a.id), ...added] } });
      toast.success("Saved");
      onClose();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  const err = (k: string) => fields[k] ? <p className="text-xs text-destructive">{fields[k]}</p> : null;

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Title" htmlFor="bce-title"><Input id="bce-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />{err("title")}</Field>
      <Field label="Message" htmlFor="bce-body"><Textarea id="bce-body" value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} />{err("body")}</Field>
      {kept.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {kept.map((a) => (
            <li key={a.id} className="relative">
              {isImage(a)
                ? <AttachmentImage a={a} className="size-20 rounded-xl object-cover" />
                : <span className="flex h-20 max-w-40 items-center gap-1.5 rounded-xl bg-fill px-3 text-xs"><Paperclip className="size-3.5 shrink-0" /><span className="truncate">{a.filename}</span></span>}
              <button type="button" aria-label={`Remove ${a.filename}`} onClick={() => setKept((k) => k.filter((x) => x.id !== a.id))} className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background"><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <input {...att.inputProps} />
      <PickedFiles files={att.files} remove={att.remove} />
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={att.pick} disabled={total >= MAX_FILES}><Paperclip /> Add photo or file</Button>
      {total > MAX_FILES && <p className="text-xs text-destructive">Max {MAX_FILES} files</p>}
      {error != null && <p role="alert" className="text-sm text-destructive">{errorText(error)}</p>}
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="accent" loading={busy} disabled={disabled}>Save</Button>
      </DialogFooter>
    </form>
  );
}

export function EditBroadcastDialog({ b, open, onClose }: { b: BroadcastOut; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit notice</DialogTitle></DialogHeader>
        {open && <EditBody b={b} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteBroadcastDialog({ b, open, onClose }: { b: BroadcastOut; open: boolean; onClose: () => void }) {
  const del = useDeleteBroadcast();
  return (
    <ConfirmDialog open={open} title="Delete this notice?" text={`"${b.title}" will be removed for everyone it was sent to. This cannot be undone.`} confirmLabel="Delete" loading={del.isPending} onClose={onClose}
      onConfirm={() => del.mutate(b.id, { onSuccess: () => { toast.success("Deleted"); onClose(); }, onError: (e) => toast.error(errorText(e)) })} />
  );
}
