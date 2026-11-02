import { NextResponse } from "next/server";
import { API, forwardHeaders, publicTokens, setRefreshCookie } from "../_shared";

export async function POST(req: Request) {
  const upstream = await fetch(`${API}/auth/login`, { method: "POST", headers: forwardHeaders(req), body: await req.text(), cache: "no-store" });
  const j = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const res = NextResponse.json(j, { status: upstream.status });
    const retry = upstream.headers.get("retry-after"); if (retry) res.headers.set("retry-after", retry);
    return res;
  }
  const res = NextResponse.json(publicTokens(j));
  setRefreshCookie(res, j.refresh_token);
  return res;
}
