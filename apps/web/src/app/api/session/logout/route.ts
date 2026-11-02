import { NextResponse } from "next/server";
import { API, clearRefreshCookie } from "../_shared";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth) await fetch(`${API}/auth/logout`, { method: "POST", headers: { Authorization: auth }, cache: "no-store" }).catch(() => {});
  const res = new NextResponse(null, { status: 204 });
  clearRefreshCookie(res);
  return res;
}
