"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Field } from "@/components/app/field";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/session-provider";
import { ACCOUNTS, STAFF, type Account } from "@/lib/mock";

type Step = "login" | "change" | "parent";

export default function LoginPage() {
  const { signIn } = useSession();
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("login");
  const [pending, setPending] = React.useState<Account | null>(null);
  const [error, setError] = React.useState("");

  const enter = (staffId: string) => { signIn(staffId); router.push("/dashboard"); };

  function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const acc = ACCOUNTS.find((a) => a.email === String(f.get("email")).trim().toLowerCase() && a.password === f.get("password"));
    if (!acc) { setError("Email or password is not right. Check with the school office."); return; }
    setError("");
    if (acc.kind === "parent") return setStep("parent");     // parents use the app
    if (acc.mustChangePassword) { setPending(acc); return setStep("change"); }
    enter(acc.staffId!);
  }
  function change(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (String(f.get("pw")).length < 8) return setError("Use at least 8 characters.");
    if (f.get("pw") !== f.get("pw2")) return setError("The two passwords do not match.");
    enter(pending!.staffId!);
  }

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-5xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Logo className="h-9 w-fit" />
        {step === "login" && (<>
          <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[52px]">Welcome back. <span className="dim">Sign in to run your school.</span></h1>
          <form className="flex max-w-sm flex-col gap-4" onSubmit={login}>
            <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" placeholder="principal@demo.in" required /></Field>
            <Field label="Password" htmlFor="pw"><Input id="pw" name="password" type="password" autoComplete="current-password" placeholder="Scool@123" required /></Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button size="lg" type="submit">Sign in</Button>
          </form>
        </>)}
        {step === "change" && (<>
          <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[52px]">Choose your password. <span className="dim">Then you are in.</span></h1>
          <form className="flex max-w-sm flex-col gap-4" onSubmit={change}>
            <p className="text-sm text-muted-foreground">You signed in with a temporary password from the school. Pick one only you know.</p>
            <Field label="New password" htmlFor="pw" hint="At least 8 characters."><Input id="pw" name="pw" type="password" autoComplete="new-password" required /></Field>
            <Field label="Repeat password" htmlFor="pw2"><Input id="pw2" name="pw2" type="password" autoComplete="new-password" required /></Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button size="lg" type="submit" variant="brand">Save and continue</Button>
          </form>
        </>)}
        {step === "parent" && (<>
          <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[52px]">You are signed in. <span className="dim">Parents use the Scool app.</span></h1>
          <p className="max-w-sm text-sm text-muted-foreground">Open the Scool app on your phone and sign in with the same email and password to see attendance, results, fees and messages.</p>
          <div className="flex flex-wrap gap-2.5"><Button size="lg"><Smartphone /> App Store</Button><Button size="lg" variant="secondary"><Smartphone /> Google Play</Button></div>
          <Button variant="link" className="w-fit" onClick={() => setStep("login")}>Back to sign in</Button>
        </>)}
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <div>
          <h2 className="text-[17px] font-bold">Demo shortcuts</h2>
          <p className="text-[13px] text-muted-foreground">Skip the form and see each role. Password for all: <b>Scool@123</b></p>
        </div>
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
        <p className="text-xs text-text-tertiary">Try <b>new.teacher@demo.in</b> / Temp@1234 for the first-login password change, and <b>parent@demo.in</b> to see the parent redirect.</p>
      </Card>
    </div>
  );
}
