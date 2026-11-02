import { ApiError, refreshAccess, tokens } from "./client";
import { API_BASE } from "./config";

type Params = Record<string, string | number | boolean | undefined | null>;

function withParams(path: string, params?: Params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return `${API_BASE}${path}${s ? `?${s}` : ""}`;
}

async function failure(res: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
  try { body = await res.json(); } catch {}
  return new ApiError(res.status, body.error?.code ?? "error", body.error?.message ?? "Something went wrong. Please try again.", body.error?.details);
}

/** A request with the Bearer token that is not JSON in or out. Retries once after refreshing an expired token. */
async function authed(make: (headers: Record<string, string>) => Promise<Response>): Promise<Response> {
  const run = () => make(tokens.get() ? { Authorization: `Bearer ${tokens.get()}` } : {});
  let res = await run();
  if (res.status === 401 && (await refreshAccess())) res = await run();
  if (!res.ok) throw await failure(res);
  return res;
}

/** Saves a blob the way a normal download link would. */
export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  const href = URL.createObjectURL(blob);
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/** Downloads a file from the API (Excel exports and templates need the Bearer token, so a plain link will not do). */
export async function downloadFile(path: string, params: Params | undefined, fallbackName: string): Promise<string> {
  const res = await authed((headers) => fetch(withParams(path, params), { headers }));
  const cd = res.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? fallbackName;
  saveBlob(await res.blob(), name);
  return name;
}

/** multipart/form-data upload, for the Excel imports. */
export async function postFile<T>(path: string, file: File, params?: Params): Promise<T> {
  const res = await authed((headers) => { const f = new FormData(); f.append("file", file); return fetch(withParams(path, params), { method: "POST", headers, body: f }); });
  return (await res.json()) as T;
}

interface UploadSlot { id: string; upload_url: string; method: string; headers: Record<string, string> }
/** The presigned flow: ask for a link, PUT the bytes to storage, confirm. Returns the file id. */
export async function uploadToStorage(file: File, purpose: "student_photo" | "student_document"): Promise<string> {
  const body = JSON.stringify({ purpose, filename: file.name, content_type: file.type || "application/octet-stream", size_bytes: file.size });
  const slot = (await (await authed((headers) => fetch(withParams("/files/upload-url"), { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body }))).json()) as UploadSlot;
  let put: Response;
  try { put = await fetch(slot.upload_url, { method: slot.method || "PUT", headers: slot.headers, body: file }); }
  catch { throw new ApiError(0, "upload_failed", "The file could not be uploaded. Check your connection and try again."); }
  if (!put.ok) throw new ApiError(put.status, "upload_failed", "The file could not be uploaded. Please try again.");
  await authed((headers) => fetch(withParams(`/files/${slot.id}/complete`), { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" }));
  return slot.id;
}
