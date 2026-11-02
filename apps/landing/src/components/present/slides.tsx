import type { CSSProperties, ReactNode } from "react";
import { OwnerScene, ParentScene, TeacherScene } from "@/components/art/scenes";
import { FEATURE_ICONS, featureScene } from "@/components/feature-assets";
import { BellIcon, CalendarCheckIcon, CheckIcon, ReceiptIcon, SchoolIcon, UsersIcon } from "@/components/icons";
import { Phone } from "@/components/mockups/devices";
import { TwoTone } from "@/components/section-heading";
import { cn } from "@/lib/cn";
import {
  ALSO,
  ALSO_HEAD,
  DECK_CLOSE,
  FEATURES,
  FOOTER,
  HELPS_LABEL,
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

const H2 = "text-[112px] font-bold leading-[1.02] tracking-[-0.04em]";

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

/* 1 */
function TitleSlide() {
  return (
    <>
      <Dots />
      <R i={1} className="absolute inset-x-0 top-[520px] text-center">
        <h2 className="text-[128px] font-bold leading-[1.02] tracking-[-0.045em]">
          <span className="block">{HERO.title}</span>
          <span className="dim block">{HERO.titleDim}</span>
        </h2>
      </R>
      <R i={3} className="absolute inset-x-0 top-[860px] text-center text-[34px] font-medium text-text-tertiary">
        {HERO.deckLine}
      </R>
    </>
  );
}

/* 2 */
function SoftwareSlide() {
  return (
    <>
      <R i={0} className="absolute left-[120px] top-[190px]">
        <h2 className={cn(H2, "text-[124px]")}>
          <TwoTone title={SOFTWARE_HEAD.title} dim={SOFTWARE_HEAD.dim} />
        </h2>
      </R>
      <R i={1} className="absolute left-[120px] right-[120px] top-[372px] flex items-center justify-between">
        <p className="text-[42px] text-text-secondary">{SOFTWARE_HEAD.line}</p>
        <div className="flex gap-3">
          {PLATFORMS.map((p) => (
            <span key={p} className="rounded-full bg-card px-8 py-3.5 text-[28px] font-semibold text-text-secondary">
              {p}
            </span>
          ))}
        </div>
      </R>
      <div className="absolute left-[120px] right-[120px] top-[510px] grid grid-cols-5 gap-[40px]">
        {FEATURES.map((f, i) => {
          const Icon = FEATURE_ICONS[f.id];
          return (
            <R key={f.id} i={2 + i} className="flex h-[370px] flex-col justify-between rounded-[48px] bg-card p-10">
              <span className="grid size-[112px] place-items-center rounded-full bg-bg text-text">
                <Icon className="size-14" />
              </span>
              <div className="list-none text-[44px] font-bold leading-[1.1] tracking-[-0.025em]">{f.name}</div>
            </R>
          );
        })}
      </div>
    </>
  );
}

/* 3 - 7 */
function FeatureSlide({ id }: { id: string }) {
  const f = FEATURES.find((x) => x.id === id)!;
  const Icon = FEATURE_ICONS[id];
  return (
    <>
      <div className="absolute bottom-[130px] left-[120px] top-[150px] flex w-[720px] flex-col justify-center">
        <R i={1}>
          <IconDisc>
            <Icon className="size-14" />
          </IconDisc>
        </R>
        <R i={2} className="mt-12">
          <h2 className="text-[116px] font-bold leading-[1.02] tracking-[-0.045em]">
            <TwoTone title={f.title} dim={f.dim} block />
          </h2>
        </R>
        <div className="mt-14 flex flex-col gap-7">
          {f.bullets.map((b, k) => (
            <R key={b} i={3 + k}>
              <div className="flex items-center gap-6 text-[38px] font-semibold tracking-[-0.01em]">
                <Check />
                {b}
              </div>
            </R>
          ))}
        </div>
      </div>
      <R i={2} className="absolute right-[120px] top-1/2 w-[880px] -translate-y-1/2 overflow-hidden rounded-[56px]">
        {featureScene(id)}
      </R>
    </>
  );
}

/* 8 */
function AlsoSlide() {
  return (
    <>
      <R i={0} className="absolute left-[120px] top-[190px]">
        <h2 className={cn(H2, "text-[124px]")}>
          <TwoTone title={ALSO_HEAD.title} dim={ALSO_HEAD.dim} />
        </h2>
      </R>
      <div className="absolute left-[120px] right-[120px] top-[500px] flex flex-wrap gap-x-6 gap-y-7">
        {ALSO.map((a, i) => (
          <R key={a} i={1 + i}>
            <div className="flex h-[128px] items-center gap-5 rounded-full bg-card px-14 text-[52px] font-semibold tracking-[-0.02em]">
              <span className="size-3.5 rounded-full bg-solid" />
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

function WhoSlide() {
  return (
    <>
      <R i={0} className="absolute left-[120px] top-[150px]">
        <h2 className={H2}>
          <TwoTone title={WHO_HEAD.title} dim={WHO_HEAD.dim} />
        </h2>
      </R>
      <div className="absolute left-[120px] right-[120px] top-[330px] grid grid-cols-3 gap-[60px]">
        {ROLES.map((r, i) => (
          <R key={r.id} i={1 + i}>
            <div className="list-none">
              <div className="overflow-hidden rounded-[44px]">{ROLE_ART[r.id]}</div>
              <h3 className="mt-7 text-[46px] font-bold tracking-[-0.025em]">{r.title}</h3>
              <p className="mt-1 text-[28px] text-text-secondary">{r.line}</p>
              <p className="mt-5 flex items-center gap-4 text-[28px] font-semibold">
                <span className="shrink-0 whitespace-nowrap rounded-full bg-fill px-4 py-1.5 text-[18px] font-semibold uppercase tracking-wide text-text-secondary">{HELPS_LABEL}</span>
                {r.helps}
              </p>
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
      <div className="absolute bottom-[130px] left-[120px] top-[150px] flex w-[860px] flex-col justify-center">
        <R i={1}>
          <h2 className="whitespace-nowrap text-[104px] font-bold leading-[1.02] tracking-[-0.045em]">
            <TwoTone title={PARENT_HEAD.title} dim={PARENT_HEAD.dim} />
          </h2>
        </R>
        <div className="mt-14 flex flex-col gap-9">
          {PARENT_POINTS.map((p, i) => {
            const Icon = PARENT_ICONS[p.icon];
            return (
              <R key={p.title} i={2 + i}>
                <div className="flex items-center gap-7">
                  <IconDisc size={92}>
                    <Icon className="size-10" />
                  </IconDisc>
                  <div>
                    <div className="text-[40px] font-bold tracking-[-0.02em]">{p.title}</div>
                    <div className="mt-0.5 text-[27px] text-text-secondary">{p.line}</div>
                  </div>
                </div>
              </R>
            );
          })}
        </div>
        <R i={5} className="mt-12 flex items-center gap-4">
          <span className="rounded-full bg-solid px-8 py-3.5 text-[28px] font-semibold text-on-solid">{PARENT_LANGS}</span>
        </R>
      </div>
      <R i={2} className="absolute right-[120px] top-[150px] h-[780px] w-[740px] overflow-hidden rounded-[64px] bg-card">
        <div className="absolute inset-x-0 bottom-0 flex translate-y-[44px] items-end justify-center">
          <div className="-mr-[34px] w-[250px] origin-bottom scale-[0.94]">
            <Phone screen="results" />
          </div>
          <div className="relative z-10 w-[320px]">
            <Phone screen="home" />
          </div>
          <div className="-ml-[34px] w-[250px] origin-bottom scale-[0.94]">
            <Phone screen="alerts" />
          </div>
        </div>
      </R>
    </>
  );
}

/* 11 */
function PricingSlide() {
  return (
    <>
      <R i={0} className="absolute left-[120px] top-[150px]">
        <h2 className={H2}>
          <TwoTone title={PRICING.title} dim={PRICING.dim} />
        </h2>
      </R>
      <R i={1} className="absolute left-[120px] right-[120px] top-[330px] flex h-[600px] items-center justify-between rounded-[64px] bg-card px-[100px]">
        <div>
          <div className="text-[360px] font-bold leading-[0.9] tracking-[-0.06em]">{PRICING.amount}</div>
          <p className="mt-6 text-[46px] font-semibold text-text-secondary">{PRICING.per}</p>
          <p className="mt-8 inline-flex rounded-full bg-bg px-8 py-3.5 text-[28px] font-semibold text-text-secondary">
            {PRICING.example.students} <span className="mx-4 text-text-tertiary">=</span> <span className="text-text">{PRICING.example.total}</span>
          </p>
        </div>
        <div className="flex flex-col gap-8">
          {PRICING.bullets.map((b, i) => (
            <R key={b} i={2 + i}>
              <div className="flex items-center gap-6 text-[40px] font-semibold tracking-[-0.01em]">
                <Check size={60} />
                {b}
              </div>
            </R>
          ))}
        </div>
      </R>
    </>
  );
}

/* 12 */
const STEP_ICONS = [SchoolIcon, CalendarCheckIcon, CheckIcon] as const;

function ContactSlide() {
  return (
    <>
      <Dots />
      <R i={0} className="absolute inset-x-0 top-[210px] text-center">
        <h2 className="text-[220px] font-bold leading-[1] tracking-[-0.05em]">
          <TwoTone title={DECK_CLOSE.title} dim={DECK_CLOSE.dim} />
        </h2>
      </R>
      <R i={2} className="absolute inset-x-0 top-[470px] text-center">
        <span className="text-[64px] font-bold tracking-[-0.03em]">{DECK_CLOSE.thanks}</span>
        <div className="mt-3 text-[36px] font-medium text-text-tertiary">
          {FOOTER.email} · krevo.tech
        </div>
      </R>
      <div className="absolute left-[140px] right-[140px] top-[740px] grid grid-cols-3 gap-[40px]">
        {DECK_CLOSE.steps.map((s, i) => {
          const Icon = STEP_ICONS[i];
          return (
            <R key={s} i={3 + i}>
              <div className="flex h-[168px] items-center gap-6 rounded-[44px] bg-card px-9">
                <span className="grid size-[84px] shrink-0 place-items-center rounded-full bg-bg text-text">
                  <Icon className="size-9" />
                </span>
                <span className="text-[32px] font-bold leading-[1.15] tracking-[-0.015em]">{s}</span>
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
