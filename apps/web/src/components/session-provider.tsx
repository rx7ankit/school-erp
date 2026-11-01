"use client";
import * as React from "react";
import { PARENT_ACCOUNTS, STAFF, type ParentAccount, type StaffRow } from "@/lib/mock";

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
  signOut: () => void;
}
const Ctx = React.createContext<SessionCtx | null>(null);
const KEY = "scool.session";
const EVT = "scool:session";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVT, cb); };
};
const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const write = (v: string | null) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch {} window.dispatchEvent(new Event(EVT)); };

/**
 * Demo session. One login for everyone: the stored value says whether it is staff or parent.
 * Replaced by real auth (token carries `kind`) when the API exists.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
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
    };
  }, [raw]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}
