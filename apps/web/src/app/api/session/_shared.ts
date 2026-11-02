import { NextResponse } from "next/server";

/** Server-side address of the API. */
export const API = `${(process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")}/api/v1`;
export const COOKIE = "krevo_rt";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function setRefreshCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/session", maxAge: THIRTY_DAYS });
}
export function clearRefreshCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/session", maxAge: 0 });
}
/** Passes the visitor's address and browser on, so the API's lockout and audit log see the real person. */
export function forwardHeaders(req: Request): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  // The API sits behind its own proxy, so the visitor's address travels in X-Client-IP, signed with a shared secret.
  if (ip && process.env.BFF_SECRET) { h["x-client-ip"] = ip; h["x-bff-secret"] = process.env.BFF_SECRET; }
  const ua = req.headers.get("user-agent"); if (ua) h["user-agent"] = ua;
  return h;
}
/** What the browser may receive: never the refresh token. */
export function publicTokens(j: { access_token: string; expires_in: number; kind: string; must_change_password: boolean }) {
  return { access_token: j.access_token, expires_in: j.expires_in, kind: j.kind, must_change_password: j.must_change_password };
}
