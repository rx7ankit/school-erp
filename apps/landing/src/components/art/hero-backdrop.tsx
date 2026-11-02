/** Soft light-grey glow with a masked dotted grid behind the hero devices. Pure CSS. */
export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-6%] bottom-0 top-[-6%] -z-0 sm:inset-x-[-4%]">
      <div className="absolute inset-0 [background:radial-gradient(ellipse_62%_58%_at_50%_46%,#E4E4E9_0%,#F1F1F4_55%,transparent_100%)]" />
      <div
        className="absolute inset-0 [background-image:radial-gradient(circle_at_center,#CFCFD5_1.1px,transparent_1.6px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_55%_55%_at_50%_48%,#000_20%,transparent_72%)]"
      />
    </div>
  );
}
