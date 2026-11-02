"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Field } from "@/components/app/field";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api/client";
import { isLive } from "@/lib/api/config";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = React.useState<"form" | "done">("form");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("pw") !== f.get("pw2")) return setError("The two passwords do not match.");
    setBusy(true); setError("");
    try { await api.post("/auth/reset-password", { token, new_password: String(f.get("pw")) }, { auth: false }); setState("done"); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not reset the password."); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-md content-center gap-8 px-4 py-10">
      <Logo className="h-9 w-fit" />
      {!isLive || !token ? (<>
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em]">This link is not valid. <span className="dim">Ask for a new one.</span></h1>
        <Button asChild variant="secondary" className="w-fit"><Link href="/login">Back to sign in</Link></Button>
      </>) : state === "done" ? (<>
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em]">Password changed. <span className="dim">Sign in with it now.</span></h1>
        <Button asChild variant="brand" size="lg" className="w-fit"><Link href="/login">Go to sign in</Link></Button>
      </>) : (<>
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em]">Choose a new password. <span className="dim">It works at once.</span></h1>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Field label="New password" htmlFor="pw" hint="At least 8 characters, with a letter and a number."><Input id="pw" name="pw" type="password" autoComplete="new-password" required /></Field>
          <Field label="Repeat password" htmlFor="pw2"><Input id="pw2" name="pw2" type="password" autoComplete="new-password" required /></Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button size="lg" type="submit" variant="brand" loading={busy}>Save password</Button>
        </form>
      </>)}
    </div>
  );
}

export default function ResetPasswordPage() {
  return <React.Suspense fallback={null}><ResetForm /></React.Suspense>;
}
