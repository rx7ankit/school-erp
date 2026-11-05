import { Logo } from "@/components/app/logo";

/** Fixed dark card colours: the left panel is always dark, in light and dark mode. */
const CARD = "rounded-[22px] border border-[#fff]/[0.08] bg-[#151517]";

function MiniDashboard() {
  const bars = [38, 56, 30, 64, 46, 100, 52];
  return (
    <div aria-hidden="true" className="relative mx-auto h-[360px] w-full max-w-[440px] select-none">
      <div className={`${CARD} auth-rise absolute left-0 top-0 w-[250px] p-5`} style={{ animationDelay: "120ms" }}>
        <div className="flex items-center gap-4">
          <div className="relative grid size-[84px] place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#2A2A2E" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset="5.8" />
            </svg>
            <span className="text-[19px] font-bold text-[#fff]">94%</span>
          </div>
          <div>
            <div className="text-[12px] text-[#fff]/50">Present today</div>
            <div className="text-[30px] font-bold leading-none text-[#fff]">423</div>
            <div className="mt-1 text-[12px] text-[#fff]/40">of 448</div>
          </div>
        </div>
      </div>
      <div className={`${CARD} auth-rise absolute right-0 top-[58px] w-[210px] p-5`} style={{ animationDelay: "280ms" }}>
        <div className="text-[12px] text-[#fff]/50">Fees today</div>
        <div className="mt-1 text-[28px] font-bold leading-none text-[#fff]">₹18,400</div>
        <div className="mt-4 flex h-[46px] items-end gap-[6px]">
          {bars.map((h, i) => (
            <span key={i} className={`flex-1 rounded-[4px] ${h === 100 ? "bg-[#F26A1B]" : "bg-[#fff]/[0.16]"}`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className={`${CARD} auth-rise absolute bottom-0 left-[34px] flex w-[320px] items-center gap-3 p-4`} style={{ animationDelay: "440ms" }}>
        <span className="grid size-10 place-items-center rounded-full bg-[#fff] text-[#000]">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        </span>
        <div>
          <div className="text-[15px] font-bold text-[#fff]">Aarav is present</div>
          <div className="text-[12px] text-[#fff]/50">Parent notified · 9:58 am</div>
        </div>
      </div>
    </div>
  );
}

/** The frame for every sign-in screen: a dark brand panel on the left (large screens), the form on the right. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-bg lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-[#fff]/[0.06] bg-[#0B0B0C] p-12 text-[#fff] lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1.2px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <Logo className="relative h-8 w-fit text-[#fff]" />
        <MiniDashboard />
        <div className="relative">
          <p className="text-[40px] font-bold leading-[1.05] tracking-[-0.03em]">
            School management, <span className="text-[#fff]/40">made easy.</span>
          </p>
          <p className="mt-6 text-[13px] text-[#fff]/35">krevo.tech</p>
        </div>
      </aside>
      <main className="relative flex min-h-dvh min-w-0 flex-col bg-[linear-gradient(180deg,#ECECF0,#FFFFFF_38%)] px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))] lg:min-h-0 lg:items-center lg:justify-center lg:bg-none lg:py-12">
        <Logo className="h-8 w-fit lg:hidden" />
        <div className="my-auto flex w-full justify-center py-10 lg:my-0 lg:py-0">
          <div className="auth-form flex w-full max-w-[380px] flex-col gap-7 [&_label]:text-[13px] [&_label]:font-medium [&_label]:text-text-secondary">
            {children}
          </div>
        </div>
        <p className="text-center text-[13px] text-text-tertiary lg:hidden">School management, made easy.</p>
      </main>
    </div>
  );
}
