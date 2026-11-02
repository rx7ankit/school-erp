import { API_BASE, isLive } from "./config";

/** The API always answers errors as { error: { code, message, details } }. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown, public retryAfter?: number) {
    super(message);
  }
  /** Field messages from a 422, keyed by field name. */
  get fields(): Record<string, string> {
    return Array.isArray(this.details) ? Object.fromEntries((this.details as { field: string; message: string }[]).map((d) => [d.field, d.message])) : {};
  }
}

/* ---- the access token lives in memory only. The refresh token is an httpOnly cookie managed by /api/session/* ---- */
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
export const tokens = {
  get: () => accessToken,
  set: (t: string | null) => { accessToken = t; },
};
export const SIGNED_OUT = "krevo:signed-out";
const signOutEvent = () => { accessToken = null; if (typeof window !== "undefined") window.dispatchEvent(new Event(SIGNED_OUT)); };

async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
  try { body = await res.json(); } catch {}
  const retry = Number(res.headers.get("retry-after")) || undefined;
  return new ApiError(res.status, body.error?.code ?? "error", body.error?.message ?? "Something went wrong. Please try again.", body.error?.details, retry);
}

/** Gets a new access token from the refresh cookie. One call at a time, however many requests failed together. */
export function refreshAccess(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch("/api/session/refresh", { method: "POST" });
      if (!res.ok) return false;
      const j = (await res.json()) as { access_token: string };
      accessToken = j.access_token;
      return true;
    } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

type Params = Record<string, string | number | boolean | undefined | null>;
interface Options { body?: unknown; params?: Params; auth?: boolean; signal?: AbortSignal }

function url(path: string, params?: Params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return `${API_BASE}${path}${s ? `?${s}` : ""}`;
}

async function send(method: string, path: string, o: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  if (o.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(url(path, o.params), { method, headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined, signal: o.signal });
}

export async function request<T>(method: string, path: string, o: Options = {}): Promise<T> {
  if (!isLive) throw new ApiError(0, "not_live", "The API is not configured.");
  let res = await send(method, path, o);
  if (res.status === 401 && o.auth !== false) {
    const err = await parseError(res.clone());
    if (["token_expired", "not_signed_in"].includes(err.code) && (await refreshAccess())) res = await send(method, path, o);
    else if (!["invalid_credentials"].includes(err.code)) { signOutEvent(); throw err; }
  }
  if (!res.ok) {
    const err = await parseError(res);
    if (res.status === 401 && o.auth !== false) signOutEvent();
    throw err;
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: <T>(path: string, params?: Params, signal?: AbortSignal) => request<T>("GET", path, { params, signal }),
  post: <T>(path: string, body?: unknown, o?: Options) => request<T>("POST", path, { ...o, body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body: body ?? {} }),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};
