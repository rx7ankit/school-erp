import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API, COOKIE, clearRefreshCookie, forwardHeaders, publicTokens, setRefreshCookie } from "../_shared";

export async function POST(req: Request) {
  const rt = (await cookies()).get(COOKIE)?.value;
  if (!rt) return NextResponse.json({ error: { code: "not_signed_in", message: "Please sign in." } }, { status: 401 });
  const upstream = await fetch(`${API}/auth/refresh`, { method: "POST", headers: forwardHeaders(req), body: JSON.stringify({ refresh_token: rt }), cache: "no-store" });
  const j = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const res = NextResponse.json(j, { status: upstream.status });
    clearRefreshCookie(res);
    return res;
  }
  const res = NextResponse.json(publicTokens(j));
  setRefreshCookie(res, j.refresh_token);
  return res;
}
