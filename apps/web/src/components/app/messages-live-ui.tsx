"use client";
import * as React from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { openAttachment } from "@/lib/api/hooks/messaging";
import { errorText } from "@/lib/api/hooks/staff";
import type { AttachmentRef } from "@/lib/api/types";
import { uploadFile } from "@/lib/api/upload";
import { formatIST, todayOnIST } from "@/lib/time";

export const MAX_FILES = 5;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

export const ErrorBox = ({ error, retry }: { error: unknown; retry?: () => void }) => (
  <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 text-sm text-destructive"><span>{errorText(error)}</span>{retry && <Button size="sm" variant="secondary" onClick={retry}>Retry</Button>}</div>
);

/** A downloadable file chip: asks the API for a short-lived link when clicked. */
export function AttachmentLink({ a }: { a: AttachmentRef }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await openAttachment(a.id); } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); } }}
      className="flex w-fit max-w-full items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-xs hover:bg-separator disabled:opacity-60">
      <Paperclip className="size-3.5 shrink-0" /><span className="truncate">{a.filename}</span><span className="shrink-0 text-text-tertiary">{(a.size_bytes / 1024 < 1024 ? `${Math.max(1, Math.round(a.size_bytes / 1024))} KB` : `${(a.size_bytes / 1048576).toFixed(1)} MB`)}</span>
    </button>
  );
}

/** Files chosen but not uploaded yet. They go up (presigned) when the message is sent. */
export function useAttachments() {
  const [files, setFiles] = React.useState<File[]>([]);
  const input = React.useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) { toast.error(`Max ${MAX_FILES} files`); break; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name} over 10 MB`); continue; }
      next.push(f);
    }
    setFiles(next);
    if (input.current) input.current.value = "";
  };
  return {
    files, clear: () => setFiles([]),
    remove: (i: number) => setFiles((fs) => fs.filter((_, j) => j !== i)),
    pick: () => input.current?.click(),
    inputProps: { ref: input, type: "file" as const, multiple: true, accept: ACCEPT, className: "sr-only", tabIndex: -1, "aria-label": "Attach files", onChange: (e: React.ChangeEvent<HTMLInputElement>) => add(e.target.files) },
  };
}

/** Uploads every file and returns their ids. Throws an ApiError that names the file that failed. */
export async function uploadAll(files: File[]): Promise<string[]> {
  const ids: string[] = [];
  for (const f of files) {
    try { ids.push((await uploadFile(f, "message_attachment")).id); }
    catch (e) { throw e instanceof ApiError ? new ApiError(e.status, e.code, `${f.name}: ${e.message}`, e.details) : e; }
  }
  return ids;
}

export function PickedFiles({ files, remove }: { files: File[]; remove: (i: number) => void }) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex max-w-full items-center gap-1.5 rounded-full bg-fill py-1 pl-3 pr-1 text-xs">
          <Paperclip className="size-3.5 shrink-0" /><span className="max-w-48 truncate">{f.name}</span>
          <button type="button" aria-label={`Remove ${f.name}`} onClick={() => remove(i)} className="grid size-5 place-items-center rounded-full hover:bg-separator"><X className="size-3" /></button>
        </li>
      ))}
    </ul>
  );
}

/** Tags: School notices are orange, subjects and General are grey. */
export const SubjectTag = ({ subject }: { subject: string }) => <Badge tone={subject === "School" ? "brand" : "neutral"}>{subject}</Badge>;
export const ClassTeacherTag = () => <Badge tone="brand">Class teacher</Badge>;
export const UnreadDot = () => <span className="inline-block size-2.5 shrink-0 rounded-full bg-brand"><span className="sr-only">Unread</span></span>;
/** Time for a list row: the time today, otherwise the short date. IST. */
export const whenShort = (utc: string) => (todayOnIST(new Date(utc)) === todayOnIST() ? formatIST(utc, "time") : formatIST(utc, "short"));
