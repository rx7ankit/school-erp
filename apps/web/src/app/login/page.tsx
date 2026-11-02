"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { Field } from "@/components/app/field";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/session-provider";
import { LiveLogin } from "@/components/app/live-login";
import { isLive } from "@/lib/api/config";
import { ACCOUNTS, DEMO_PARENT_EMAIL, STAFF, type Account } from "@/lib/mock";
import { usePending } from "@/lib/use-pending";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Step = "login" | "change";

function DemoLogin() {
  const { signIn, signInParent, signInOwner } = useSession();
  const { run, is } = usePending(800);
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("login");
  const [pending, setPending] = React.useState<Account | null>(null);
  const [error, setError] = React.useState("");
  const [forgot, setForgot] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const enter = (staffId: string) => { signIn(staffId); logAudit({ category: "security", action: "login.success", summary: "Signed in" }); router.push("/dashboard"); };

  function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const acc = ACCOUNTS.find((a) => a.email === String(f.get("email")).trim().toLowerCase() && a.password === f.get("password"));
    if (!acc) { logAudit({ category: "security", action: "login.failed", summary: `Failed sign-in attempt for ${String(f.get("email")).trim()} (wrong email or password)`, entity: String(f.get("email")).trim(), sensitive: true, actorName: "Unknown", actorRole: "Not signed in" }); setError("Email or password is not right. Check with the school office."); return; }
    setError("");
    // One login for everyone. The account kind decides where you land.
    run("login", () => {
      if (acc.kind === "owner") { signInOwner(); router.push("/owner"); return; }
      if (acc.kind === "parent") { signInParent(acc.parentEmail === "DEMO" ? DEMO_PARENT_EMAIL : acc.email); router.push("/parent"); return; }
      if (acc.mustChangePassword) { setPending(acc); setStep("change"); return; }
      enter(acc.staffId!);
    });
  }
  function change(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (String(f.get("pw")).length < 8) return setError("Use at least 8 characters.");
    if (f.get("pw") !== f.get("pw2")) return setError("The two passwords do not match.");
    run("change", () => enter(pending!.staffId!));
  }

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-5xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Logo className="h-9 w-fit" />
        {step === "login" && (<>
          <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[52px]">Sign in.</h1>
          <form className="flex max-w-sm flex-col gap-4" onSubmit={login}>
            <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" placeholder="you@school.in" required /></Field>
            <Field label="Password" htmlFor="pw"><Input id="pw" name="password" type="password" autoComplete="current-password" placeholder="Krevo@123" required /></Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button size="lg" type="submit" variant="accent" loading={is("login")}>Sign in</Button>
            <Button type="button" variant="link" className="w-fit" onClick={() => { setSent(false); setForgot(true); }}>Forgot password?</Button>
          </form>
        </>)}
        {step === "change" && (<>
          <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[52px]">New password.</h1>
          <form className="flex max-w-sm flex-col gap-4" onSubmit={change}>
            <Field label="New password" htmlFor="pw" hint="8+ characters"><Input id="pw" name="pw" type="password" autoComplete="new-password" required /></Field>
            <Field label="Repeat password" htmlFor="pw2"><Input id="pw2" name="pw2" type="password" autoComplete="new-password" required /></Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button size="lg" type="submit" variant="brand" loading={is("change")}>Save</Button>
          </form>
        </>)}
      </div>

      <Dialog open={forgot} onOpenChange={setForgot}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password</DialogTitle><DialogDescription className="sr-only">Enter your email to get a reset link.</DialogDescription></DialogHeader>
          {sent ? <p className="rounded-xl bg-card p-4 text-sm">Check your email for a reset link.</p> : (
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run("forgot", () => setSent(true)); }}>
              <Field label="Email" htmlFor="fe"><Input id="fe" name="email" type="email" required /></Field>
              <DialogFooter><Button type="button" variant="secondary" onClick={() => setForgot(false)}>Cancel</Button><Button type="submit" variant="brand" loading={is("forgot")}>Send link</Button></DialogFooter>
            </form>)}
          {sent && <DialogFooter><Button variant="brand" onClick={() => setForgot(false)}>Done</Button></DialogFooter>}
        </DialogContent>
      </Dialog>
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-[17px] font-bold">Demo <span className="text-[13px] font-normal text-muted-foreground">password Krevo@123</span></h2>
        <ul className="flex flex-col">
          {STAFF.map((s) => (
            <li key={s.id}>
              <button onClick={() => enter(s.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-card-hover">
                <Avatar name={s.name} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.name}</span><span className="block truncate text-[13px] text-muted-foreground">{s.designation}</span></span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-text-tertiary">new.teacher@demo.in (Temp@1234) · owner@krevo.tech · parent@demo.in</p>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return isLive ? <LiveLogin /> : <DemoLogin />;
}
