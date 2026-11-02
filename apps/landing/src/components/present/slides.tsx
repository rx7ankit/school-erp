import type { CSSProperties, ReactNode } from "react";
import { OwnerScene, ParentScene, TeacherScene } from "@/components/art/scenes";
import { FEATURE_ICONS, featureScene } from "@/components/feature-assets";
import { BellIcon, CalendarCheckIcon, CheckIcon, ReceiptIcon, SchoolIcon, UsersIcon } from "@/components/icons";
import { Phone } from "@/components/mockups/devices";
import { Logo } from "@/components/logo";
import { TwoTone } from "@/components/section-heading";
import { cn } from "@/lib/cn";
import {
  ALSO,
  ALSO_HEAD,
  DECK_CLOSE,
  FEATURES,
  FOOTER,
  HERO,
  PARENT_HEAD,
  PARENT_LANGS,
  PARENT_POINTS,
  PLATFORMS,
  PRICING,
  ROLES,
  SOFTWARE_HEAD,
  WHO_HEAD,
} from "@/lib/content";

/** Every slide is composed on a fixed 1920 x 1080 stage. `R` marks the pieces that rise in, staggered by `i`. */
function R({ i = 0, className, style, children }: { i?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={cn("dk-r", className)} style={{ ...style, "--i": i } as CSSProperties}>
      {children}
    </div>
  );
}

const H2 = "text-[124px] font-bold leading-[1.02] tracking-[-0.045em]";
const LIFT = "[filter:drop-shadow(0_14px_30px_rgba(20,20,30,0.09))]";
const SOLID = "bg-[linear-gradient(180deg,#2A2A2D,#1C1C1E)]";

/** Soft page wash, the same light-grey-to-white fade with a blush glow the site hero uses. */
function Wash({ glow = true }: { glow?: boolean }) {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#ECECF0,#FFFFFF_55%)]" />
      {glow ? <div className="absolute inset-x-0 bottom-0 h-[60%] bg-[linear-gradient(to_bottom,rgba(255,222,200,0),rgba(255,222,200,0.45))]" /> : null}
    </div>
  );
}

function Dots() {
  return <div aria-hidden="true" className="dk-dots absolute inset-0" />;
}

function Check({ size = 56 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-solid text-on-solid" style={{ width: size, height: size }}>
      <CheckIcon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

function IconDisc({ children, size = 112, className }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-card text-text", className)} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

/** White floating card used for the "popping" details beside a panel. */
function Float({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[40px] bg-bg", LIFT, className)}>{children}</div>;
}

/* 1 */
function TitleSlide() {
  return (
    <>
      <Wash />
      <Dots />
      <R i={1} className="absolute inset-x-0 top-[462px] text-center">
        <h2 className="text-[150px] font-bold leading-[1.02] tracking-[-0.05em]">
          <span className="block">{HERO.title}</span>
          <span className="dim block">{HERO.titleDim}</span>
        </h2>
      </R>
      <R i={3} className="absolute inset-x-0 top-[815px] text-center text-[40px] font-medium text-text-secondary">
        {HERO.deckLine}
      </R>
      <div className="absolute inset-x-0 top-[895px] flex justify-center gap-5">
        {FEATURES.map((f, i) => {
          const Icon = FEATURE_ICONS[f.id];
          return (
            <R key={f.id} i={4 + i}>
              <span className={cn("flex h-[76px] items-center gap-4 rounded-full bg-bg px-8 text-[30px] font-semibold", LIFT)}>
                <Icon className="size-8 text-text-secondary" />
                {f.name}
              </span>
            </R>
          );
        })}
      </div>
    </>
  );
}

/* 2 : the node diagram from the site */
const SPOTS = [
  { x: 330, y: 700 },
  { x: 330, y: 930 },
  { x: 1590, y: 700 },
  { x: 1590, y: 930 },
  { x: 960, y: 560 },
] as const;

function SoftwareSlide() {
  return (
    <>
      <Wash glow={false} />
      <R i={0} className="absolute inset-x-0 top-[130px] text-center">
        <h2 className={H2}>
          <TwoTone title={SOFTWARE_HEAD.title} dim={SOFTWARE_HEAD.dim} />
        </h2>
        <p className="mt-6 text-[44px] text-text-secondary">{SOFTWARE_HEAD.line}</p>
      </R>
      <svg aria-hidden="true" viewBox="0 0 1920 1080" className="absolute inset-0 size-full">
        {SPOTS.map((s, i) => (
          <path
            key={i}
            d={i === 4 ? `M960 ${s.y + 40} V${760}` : `M${s.x + (s.x < 960 ? 150 : -150)} ${s.y} C${s.x < 960 ? 700 : 1220} ${s.y} ${s.x < 960 ? 760 : 1160} 830 ${s.x < 960 ? 820 : 1100} 830`}
            fill="none"
            stroke="#C9CBD3"
            strokeWidth="3"
          />
        ))}
      </svg>
      <R i={1} className="absolute left-1/2 top-[830px] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-full bg-[rgba(29,29,31,0.08)] p-4">
          <div className={cn("flex h-[150px] items-center gap-5 rounded-full px-[72px] text-[#fff]", SOLID, "[filter:drop-shadow(0_18px_30px_rgba(20,20,30,0.25))]")}>
            <Logo className="h-14" />
          </div>
        </div>
      </R>
      {FEATURES.map((f, i) => {
        const Icon = FEATURE_ICONS[f.id];
        const s = SPOTS[i];
        return (
          <R key={f.id} i={2 + i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: s.x, top: s.y }}>
            <span className={cn("flex h-[96px] items-center gap-5 whitespace-nowrap rounded-full bg-bg px-11 text-[38px] font-semibold", LIFT)}>
              <Icon className="size-9 text-text-secondary" />
              {f.name}
            </span>
          </R>
        );
      })}
      <R i={7} className="absolute inset-x-0 bottom-[44px] flex justify-center gap-4">
        {PLATFORMS.map((p) => (
          <span key={p} className="rounded-full bg-card px-8 py-3 text-[26px] font-semibold text-text-secondary">
            {p}
          </span>
        ))}
      </R>
    </>
  );
}

/* 3 - 7 */
const PANEL: Record<string, string> = {
  attendance: "bg-[linear-gradient(160deg,#F1F2F5,#E3E7EE)]",
  fees: "bg-[linear-gradient(160deg,#FFF3EA,#FFE2CF)]",
  results: "bg-[linear-gradient(160deg,#FCF6E2,#F5EACA)]",
  messages: "bg-[linear-gradient(160deg,#EEF3F8,#DEE7F1)]",
  timetable: "bg-[linear-gradient(160deg,#F3F0F7,#E6E1EF)]",
};

function FeatureSlide({ id }: { id: string }) {
  const f = FEATURES.find((x) => x.id === id)!;
  const Icon = FEATURE_ICONS[id];
  return (
    <>
      <div className="absolute bottom-[130px] left-[120px] top-[140px] flex w-[760px] flex-col justify-center">
        <R i={1}>
          <span className="inline-flex h-[76px] items-center gap-4 rounded-full bg-card pl-5 pr-8 text-[30px] font-semibold text-text-secondary">
            <Icon className="size-9 text-text" />
            {f.name}
          </span>
        </R>
        <R i={2} className="mt-10">
          <h2 className="text-[132px] font-bold leading-[1] tracking-[-0.05em]">
            <TwoTone title={f.title} dim={f.dim} block />
          </h2>
        </R>
        <R i={3}>
          <p className="mt-8 text-[38px] leading-snug text-text-secondary">{f.line}</p>
        </R>
        <div className="mt-12 flex flex-col gap-6">
          {f.bullets.map((b, k) => (
            <R key={b} i={4 + k}>
              <div className="flex items-center gap-6 text-[36px] font-semibold tracking-[-0.01em]">
                <Check size={52} />
                {b}
              </div>
            </R>
          ))}
        </div>
      </div>
      <R i={2} className={cn("absolute bottom-[110px] right-[100px] top-[110px] w-[900px] overflow-hidden rounded-[72px]", PANEL[id])}>
        <div className="absolute left-1/2 top-1/2 w-[1000px] -translate-x-1/2 -translate-y-1/2 scale-[0.84]">{featureScene(id)}</div>
      </R>
    </>
  );
}

/* 8 */
function AlsoSlide() {
  return (
    <>
      <Wash glow={false} />
      <R i={0} className="absolute inset-x-0 top-[200px] text-center">
        <h2 className={H2}>
          <TwoTone title={ALSO_HEAD.title} dim={ALSO_HEAD.dim} />
        </h2>
      </R>
      <div className="absolute inset-x-[160px] top-[480px] flex flex-wrap justify-center gap-x-7 gap-y-8">
        {ALSO.map((a, i) => (
          <R key={a} i={1 + i}>
            <div className={cn("flex h-[132px] items-center gap-5 rounded-full bg-bg px-14 text-[54px] font-semibold tracking-[-0.025em]", LIFT)}>
              <span className="size-4 rounded-full bg-solid" />
              {a}
            </div>
          </R>
        ))}
      </div>
    </>
  );
}

/* 9 */
const ROLE_ART = { owner: <OwnerScene />, teacher: <TeacherScene />, parent: <ParentScene /> } as const;
const ROLE_TINT = { owner: "bg-[#FFE9DC]", teacher: "bg-[#E4E8EF]", parent: "bg-[#F4EDE4]" } as const;

function WhoSlide() {
  return (
    <>
      <Wash glow={false} />
      <R i={0} className="absolute inset-x-0 top-[120px] text-center">
        <h2 className={H2}>
          <TwoTone title={WHO_HEAD.title} dim={WHO_HEAD.dim} />
        </h2>
      </R>
      <div className="absolute left-[100px] right-[100px] top-[330px] grid grid-cols-3 gap-[44px]">
        {ROLES.map((r, i) => (
          <R key={r.id} i={1 + i}>
            <div className={cn("rounded-[64px] p-[22px] pb-12", ROLE_TINT[r.id])}>
              <div className="overflow-hidden rounded-[48px]">{ROLE_ART[r.id]}</div>
              <div className="px-5">
                <h3 className="mt-9 text-[58px] font-bold tracking-[-0.035em]">{r.title}</h3>
                <p className="mt-2 text-[32px] leading-snug text-text-secondary">{r.line}</p>
              </div>
            </div>
          </R>
        ))}
      </div>
    </>
  );
}

/* 10 */
const PARENT_ICONS = { bell: BellIcon, users: UsersIcon, receipt: ReceiptIcon } as const;

function ParentSlide() {
  return (
    <>
      <div className="absolute bottom-[130px] left-[120px] top-[140px] flex w-[860px] flex-col justify-center">
        <R i={1}>
          <h2 className="whitespace-nowrap text-[120px] font-bold leading-[1.02] tracking-[-0.05em]">
            <TwoTone title={PARENT_HEAD.title} dim={PARENT_HEAD.dim} />
          </h2>
        </R>
        <div className="mt-14 flex flex-col gap-9">
          {PARENT_POINTS.map((p, i) => {
            const Icon = PARENT_ICONS[p.icon];
            return (
              <R key={p.title} i={2 + i}>
                <div className="flex items-center gap-7">
                  <IconDisc size={96}>
                    <Icon className="size-11" />
                  </IconDisc>
                  <div>
                    <div className="text-[42px] font-bold tracking-[-0.025em]">{p.title}</div>
                    <div className="mt-0.5 text-[28px] text-text-secondary">{p.line}</div>
                  </div>
                </div>
              </R>
            );
          })}
        </div>
        <R i={5} className="mt-12">
          <span className="inline-flex rounded-full bg-solid px-9 py-4 text-[30px] font-semibold text-on-solid">{PARENT_LANGS}</span>
        </R>
      </div>
      <R i={2} className="absolute bottom-[110px] right-[100px] top-[110px] w-[800px] overflow-hidden rounded-[72px] bg-[linear-gradient(160deg,#F7F1E8,#EFE5D6)]">
        <div className="absolute inset-x-0 bottom-0 flex translate-y-[56px] items-end justify-center">
          <div className="-mr-[30px] w-[270px] origin-bottom scale-[0.94]">
            <Phone screen="results" />
          </div>
          <div className="relative z-10 w-[350px]">
            <Phone screen="home" />
          </div>
          <div className="-ml-[30px] w-[270px] origin-bottom scale-[0.94]">
            <Phone screen="alerts" />
          </div>
        </div>
      </R>
      <R i={6} className="absolute right-[50px] top-[250px] z-10">
        <Float className="flex items-center gap-5 px-8 py-6">
          <span className="grid size-[68px] place-items-center rounded-full bg-solid text-on-solid">
            <BellIcon className="size-8" />
          </span>
          <div>
            <div className="text-[32px] font-bold tracking-[-0.02em]">Aarav is present</div>
            <div className="text-[22px] text-text-secondary">9:58 am</div>
          </div>
        </Float>
      </R>
    </>
  );
}

/* 11 */
function PricingSlide() {
  return (
    <>
      <Wash />
      <R i={0} className="absolute left-[120px] top-[130px]">
        <h2 className={H2}>
          <TwoTone title={PRICING.title} dim={PRICING.dim} />
        </h2>
      </R>
      <R i={1} className="absolute bottom-[120px] left-[120px] top-[340px] w-[780px]">
        <div className={cn("relative h-full overflow-hidden rounded-[72px] p-[80px] text-[#fff]", SOLID)}>
          <span aria-hidden="true" className="absolute inset-x-[90px] top-0 h-[2px] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)]" />
          <span aria-hidden="true" className="absolute -right-[160px] -top-[160px] size-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.12),transparent)]" />
          <div className="relative text-[420px] font-bold leading-[0.9] tracking-[-0.065em]">{PRICING.amount}</div>
          <p className="relative mt-10 text-[50px] font-medium text-[#fff]/60">{PRICING.per}</p>
        </div>
      </R>
      <R i={2} className="absolute right-[120px] top-[360px] z-10">
        <Float className="px-10 py-8">
          <p className="text-[28px] font-semibold text-text-secondary">{PRICING.example.students}</p>
          <p className="mt-2 text-[72px] font-bold leading-none tracking-[-0.04em]">{PRICING.example.total}</p>
        </Float>
      </R>
      <div className="absolute right-[120px] top-[590px] flex w-[860px] flex-col gap-8">
        {PRICING.bullets.map((b, i) => (
          <R key={b} i={3 + i}>
            <div className="flex items-center gap-7 text-[44px] font-semibold tracking-[-0.015em]">
              <Check size={64} />
              {b}
            </div>
          </R>
        ))}
      </div>
    </>
  );
}

/* 12 */
const STEP_ICONS = [SchoolIcon, CalendarCheckIcon, CheckIcon] as const;

function ContactSlide() {
  return (
    <>
      <Wash />
      <Dots />
      <R i={0} className="absolute inset-x-0 top-[190px] text-center">
        <h2 className="text-[230px] font-bold leading-[1] tracking-[-0.055em]">
          <TwoTone title={DECK_CLOSE.title} dim={DECK_CLOSE.dim} />
        </h2>
      </R>
      <R i={2} className="absolute inset-x-0 top-[462px] text-center">
        <span className="text-[68px] font-bold tracking-[-0.03em]">{DECK_CLOSE.thanks}</span>
        <div className="mt-4 text-[38px] font-medium text-text-secondary">
          {FOOTER.email} · krevo.tech
        </div>
      </R>
      <div className="absolute left-[140px] right-[140px] top-[740px] grid grid-cols-3 gap-[40px]">
        {DECK_CLOSE.steps.map((s, i) => {
          const Icon = STEP_ICONS[i];
          return (
            <R key={s} i={3 + i}>
              <div className={cn("flex h-[168px] items-center gap-6 rounded-[48px] bg-bg px-10", LIFT)}>
                <span className="grid size-[88px] shrink-0 place-items-center rounded-full bg-card text-text">
                  <Icon className="size-10" />
                </span>
                <span className="text-[34px] font-bold leading-[1.15] tracking-[-0.02em]">{s}</span>
              </div>
            </R>
          );
        })}
      </div>
    </>
  );
}

export type SlideDef = { id: string; section: string; name: string; el: ReactNode };

/** Same order as the site: hero, software, who it is for, pricing, contact. */
export const SLIDES: SlideDef[] = [
  { id: "title", section: "", name: "Krevo", el: <TitleSlide /> },
  { id: "software", section: "Software", name: "What it is", el: <SoftwareSlide /> },
  ...FEATURES.map((f) => ({ id: f.id, section: "Software", name: f.name, el: <FeatureSlide id={f.id} /> })),
  { id: "also", section: "Software", name: "Also included", el: <AlsoSlide /> },
  { id: "who", section: "Who it's for", name: "Who it's for", el: <WhoSlide /> },
  { id: "parents", section: "Who it's for", name: "The parent app", el: <ParentSlide /> },
  { id: "pricing", section: "Pricing", name: "Pricing", el: <PricingSlide /> },
  { id: "contact", section: "Contact", name: "Welcome aboard", el: <ContactSlide /> },
];
