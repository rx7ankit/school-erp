"use client";
import * as React from "react";
import { STAFF, type StaffRow } from "@/lib/mock";

interface SessionCtx {
  user: StaffRow | null;
  ready: boolean;
  signIn: (id: string) => void;
  signOut: () => void;
}
const Ctx = React.createContext<SessionCtx | null>(null);
const KEY = "scool.staff";
const EVT = "scool:session";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVT, cb); };
};
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** Demo session: picks a staff persona. Replaced by real auth when the API exists. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  // undefined on the server (not ready), string or null on the client
  const id = React.useSyncExternalStore<string | null | undefined>(subscribe, read, () => undefined);

  const value = React.useMemo<SessionCtx>(() => ({
    user: STAFF.find((s) => s.id === id) ?? null,
    ready: id !== undefined,
    signIn: (next) => { try { localStorage.setItem(KEY, next); } catch {} window.dispatchEvent(new Event(EVT)); },
    signOut: () => { try { localStorage.removeItem(KEY); } catch {} window.dispatchEvent(new Event(EVT)); },
  }), [id]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}
