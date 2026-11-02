import { ApiError, api } from "./client";

export interface UploadedFile { id: string; filename: string; content_type: string; size_bytes: number }
interface UploadSlot { id: string; upload_url: string; method: string; headers: Record<string, string> }

/** Which API the upload goes through: staff use /files, parents have their own messaging routes. */
export type UploadKind = "staff" | "parent";
const ROUTES: Record<UploadKind, { slot: string; complete: (id: string) => string }> = {
  staff: { slot: "/files/upload-url", complete: (id) => `/files/${id}/complete` },
  parent: { slot: "/parent/messaging/upload-url", complete: (id) => `/parent/messaging/files/${id}/complete` },
};

/**
 * Presigned upload in three steps: ask the API for a link, PUT the bytes straight to storage, confirm.
 * Throws ApiError with a message that is safe to show (type not allowed, file too large, upload failed ...).
 */
export async function uploadFile(file: File, purpose: string, kind: UploadKind = "staff"): Promise<UploadedFile> {
  const r = ROUTES[kind];
  const type = file.type || "application/octet-stream";
  const slot = await api.post<UploadSlot>(r.slot, { purpose, filename: file.name, content_type: type, size_bytes: file.size });
  let res: Response;
  try {
    res = await fetch(slot.upload_url, { method: slot.method || "PUT", headers: slot.headers, body: file });
  } catch {
    throw new ApiError(0, "upload_failed", `Could not upload ${file.name}. Check your connection and try again.`);
  }
  if (!res.ok) throw new ApiError(res.status, "upload_failed", `Could not upload ${file.name}. Please try again.`);
  return api.post<UploadedFile>(r.complete(slot.id));
}
