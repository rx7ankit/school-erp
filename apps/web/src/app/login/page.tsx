"use client";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { useSession } from "@/components/session-provider";
import { STAFF } from "@/lib/mock";

export default function LoginPage() {
  const { signIn } = useSession();
  const router = useRouter();
  const go = (id: string) => { signIn(id); router.push("/dashboard"); };
  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-5xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Logo className="h-9 w-fit" />
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[52px]">
          Welcome back. <span className="dim">Sign in to run your school.</span>
        </h1>
        <form className="flex max-w-sm flex-col gap-4" onSubmit={(e) => { e.preventDefault(); go("s1"); }}>
          <Field label="Mobile number or email" htmlFor="id"><Input id="id" placeholder="staff@school.in" autoComplete="username" /></Field>
          <Field label="Password" htmlFor="pw"><Input id="pw" type="password" autoComplete="current-password" /></Field>
          <Button size="lg" type="submit">Sign in</Button>
        </form>
      </div>
      <Card className="flex flex-col gap-4 p-6">
        <div>
          <h2 className="text-[17px] font-bold">Demo: sign in as</h2>
          <p className="text-[13px] text-muted-foreground">Each person sees a different menu, based on their permissions.</p>
        </div>
        <ul className="flex flex-col">
          {STAFF.map((s) => (
            <li key={s.id}>
              <button onClick={() => go(s.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-card-hover">
                <Avatar name={s.name} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.name}</span><span className="block truncate text-[13px] text-muted-foreground">{s.designation}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
