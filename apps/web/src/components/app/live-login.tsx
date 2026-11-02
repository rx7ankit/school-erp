"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/app/field";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/session-provider";
import { ApiError, api } from "@/lib/api/client";

type Step = "login" | "change" | "parent";

/** Sign-in against the real API. One form for everyone, the account kind decides where you land. */
export function LiveLogin() {
  const { login, reload, signOut } = useSession();
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("login");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [temp, setTemp] = React.useState("");
  const [forgot, setForgot] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const land = (kind: string) => {
    if (kind === "owner") router.push("/owner");
    else if (kind === "staff") router.push("/dashboard");
    else setStep("parent");
  };

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError("");
    try {
      const me = await login(String(f.get("email")).trim(), String(f.get("password")));
      if (me.must_change_password) { setTemp(String(f.get("password"))); setStep("change"); } else land(me.kind);
    } catch (err) {
      setError(err instanceof ApiError ? (err.code === "login_locked" && err.retryAfter ? `${err.message} (about ${Math.ceil(err.retryAfter / 60)} min)` : err.message) : "Could not reach the server. Check your connection.");
    } finally { setBusy(false); }
  }

  async function onChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("pw") !== f.get("pw2")) return setError("The two passwords do not match.");
    setBusy(true); setError("");
    try {
      await api.post("/auth/change-password", { current_password: temp, new_password: String(f.get("pw")) });
      const me = await reload();
      if (me) land(me.kind);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not change the password."); } finally { setBusy(false); }
  }

  async function onForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try { await api.post("/auth/forgot-password", { email: String(new FormData(e.currentTarget).get("email")).trim() }, { auth: false }); setSent(true); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not send the link."); setForgot(false); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-8 px-4 py-10">
      <Logo className="h-9 w-fit" />
      {step === "login" && (<>
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Welcome back. <span className="dim">Sign in to continue.</span></h1>
        <form className="flex flex-col gap-4" onSubmit={onLogin}>
          <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" required /></Field>
          <Field label="Password" htmlFor="pw"><Input id="pw" name="password" type="password" autoComplete="current-password" required /></Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button size="lg" type="submit" loading={busy}>Sign in</Button>
          <Button type="button" variant="link" className="w-fit" onClick={() => { setSent(false); setForgot(true); }}>Forgot password?</Button>
        </form>
      </>)}
      {step === "change" && (<>
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Choose your password. <span className="dim">Then you are in.</span></h1>
        <form className="flex flex-col gap-4" onSubmit={onChange}>
          <p className="text-sm text-muted-foreground">You signed in with a temporary password from the school. Pick one only you know.</p>
          <Field label="New password" htmlFor="npw" hint="At least 8 characters, with a letter and a number."><Input id="npw" name="pw" type="password" autoComplete="new-password" required /></Field>
          <Field label="Repeat password" htmlFor="npw2"><Input id="npw2" name="pw2" type="password" autoComplete="new-password" required /></Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button size="lg" type="submit" variant="brand" loading={busy}>Save and continue</Button>
        </form>
      </>)}
      {step === "parent" && (<>
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[48px]">You are signed in. <span className="dim">Parents use the Scool app.</span></h1>
        <p className="text-sm text-muted-foreground">Open the Scool app on your phone and sign in with the same email and password.</p>
        <Button variant="secondary" className="w-fit" onClick={async () => { await signOut(); setStep("login"); }}>Sign out</Button>
      </>)}

      <Dialog open={forgot} onOpenChange={setForgot}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset your password</DialogTitle><DialogDescription>Enter the email the school gave you. If it is registered, we email a link to choose a new password.</DialogDescription></DialogHeader>
          {sent ? (<>
            <p className="rounded-xl bg-card p-4 text-sm">If that email is registered, a reset link is on its way. It works for 30 minutes.</p>
            <DialogFooter><Button variant="brand" onClick={() => setForgot(false)}>Done</Button></DialogFooter>
          </>) : (
            <form className="flex flex-col gap-4" onSubmit={onForgot}>
              <Field label="Email" htmlFor="fe"><Input id="fe" name="email" type="email" required /></Field>
              <DialogFooter><Button type="button" variant="secondary" onClick={() => setForgot(false)}>Cancel</Button><Button type="submit" variant="brand" loading={busy}>Send reset link</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
