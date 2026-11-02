"use client";
import * as React from "react";
import { ApiError, SIGNED_OUT, api, refreshAccess, tokens } from "@/lib/api/client";
import { isLive } from "@/lib/api/config";
import type { Me } from "@/lib/api/types";
import { PARENT_ACCOUNTS, STAFF, type ParentAccount, type StaffRow, type Student } from "@/lib/mock";

interface SessionCtx {
  /** Signed-in staff member, if the login was a staff login. */
  user: StaffRow | null;
  /** Signed-in parent account, if the login was a parent login. */
  parent: ParentAccount | null;
  /** True when the platform owner (super admin) is signed in. */
  owner: boolean;
  ready: boolean;
  signIn: (staffId: string) => void;
  signInParent: (email: string) => void;
  signInOwner: () => void;
  signOut: () => void | Promise<void>;
  /** True when connected to the real API. */
  live: boolean;
  /** The signed-in person as the API describes them (live mode only). */
  me: Me | null;
  /** Live mode: sign in with email and password. Throws ApiError. Returns who signed in. */
  login: (email: string, password: string) => Promise<Me>;
  /** Live mode: reload who is signed in, for example after changing the password. */
  reload: () => Promise<Me | null>;
}
const Ctx = React.createContext<SessionCtx | null>(null);
const KEY = "krevo.session";
const EVT = "krevo:session";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVT, cb); };
};
const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const write = (v: string | null) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch {} window.dispatchEvent(new Event(EVT)); };

const notLive = () => { throw new Error("Demo mode: use signIn."); };

/** Demo session: the stored value says who is signed in. Used when no API is configured. */
function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  // undefined on the server (not ready), string on the client ("" = signed out)
  const raw = React.useSyncExternalStore<string | undefined>(subscribe, read, () => undefined);

  const value = React.useMemo<SessionCtx>(() => {
    const [kind, id] = (raw ?? "").split(":");
    return {
      user: kind === "staff" ? STAFF.find((s) => s.id === id) ?? null : null,
      parent: kind === "parent" ? PARENT_ACCOUNTS.find((p) => p.email === id) ?? null : null,
      owner: kind === "owner",
      ready: raw !== undefined,
      signIn: (staffId) => write(`staff:${staffId}`),
      signInParent: (email) => write(`parent:${email}`),
      signInOwner: () => write("owner:1"),
      signOut: () => write(null),
      live: false, me: null, login: async () => notLive(), reload: async () => null,
    };
  }, [raw]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The API person as the staff-shaped object the screens already understand. Class assignments carry real ids. */
function asStaffRow(me: Me): StaffRow {
  return {
    id: me.id, name: me.name, designation: me.designation ?? "", isAdmin: me.is_admin, permissions: me.permissions as StaffRow["permissions"],
    classes: me.assignments.map((a) => ({ classId: a.class_id, role: a.role as "class_teacher" | "subject_teacher", subject: a.subject_id ?? undefined })),
    employeeCode: "", department: "", phone: "", joinedOn: "", email: me.email, invite: "active",
  };
}

/** The signed-in guardian as the parent portal understands it. Children come from /auth/me; ids are the real student ids. */
function asParentAccount(me: Me): ParentAccount {
  const children: Student[] = (me.children ?? []).map((c) => ({
    id: c.student_id, scholarNo: "", name: c.name, classId: "", rollNo: 0, gender: "M", dob: "", guardian: me.name, guardianEmail: me.email, phone: "", address: "",
    status: c.read_only ? "left" : "active",
  }));
  return { email: me.email, guardian: me.name, phone: "", children, status: "active", sendCount: 0 };
}

/** Real session. The access token stays in memory, the refresh token is an httpOnly cookie set by /api/session/*. */
function LiveSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ ready: boolean; me: Me | null }>({ ready: false, me: null });

  const reload = React.useCallback(async () => {
    try {
      const me = await api.get<Me>("/auth/me");
      setState({ ready: true, me });
      return me;
    } catch {
      setState({ ready: true, me: null });
      return null;
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await refreshAccess();   // a returning visitor still has the refresh cookie
      if (!alive) return;
      if (ok) await reload(); else setState({ ready: true, me: null });
    })();
    const out = () => setState({ ready: true, me: null });
    window.addEventListener(SIGNED_OUT, out);
    return () => { alive = false; window.removeEventListener(SIGNED_OUT, out); };
  }, [reload]);

  const value = React.useMemo<SessionCtx>(() => ({
    user: state.me?.kind === "staff" ? asStaffRow(state.me) : null,
    parent: state.me?.kind === "parent" ? asParentAccount(state.me) : null,
    owner: state.me?.kind === "owner",
    ready: state.ready,
    signIn: () => {}, signInParent: () => {}, signInOwner: () => {},
    signOut: async () => {
      const t = tokens.get();
      await fetch("/api/session/logout", { method: "POST", headers: t ? { Authorization: `Bearer ${t}` } : {} }).catch(() => {});
      tokens.set(null);
      setState({ ready: true, me: null });
    },
    live: true, me: state.me, reload,
    login: async (email, password) => {
      const res = await fetch("/api/session/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, device: navigator.userAgent.slice(0, 120) }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, j.error?.code ?? "error", j.error?.message ?? "Could not sign in.", j.error?.details, Number(res.headers.get("retry-after")) || undefined);
      tokens.set(j.access_token);
      const me = await reload();
      if (!me) throw new ApiError(500, "no_profile", "Could not load your account.");
      return me;
    },
  }), [state, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return isLive ? <LiveSessionProvider>{children}</LiveSessionProvider> : <DemoSessionProvider>{children}</DemoSessionProvider>;
}

export function useSession() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}
