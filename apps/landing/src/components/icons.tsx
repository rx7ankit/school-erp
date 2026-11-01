import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5 shrink-0"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);
export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </Icon>
);
export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
  </Icon>
);
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h16M4 16h16" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

/* Navigation glyphs used inside the product mockups. */
export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11 12 4l8 7v9H4z" />
  </Icon>
);
export const CalendarCheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="15" rx="3" />
    <path d="M4 10h16M9 3v4M15 3v4M9.5 15l2 2 3.5-3.5" />
  </Icon>
);
export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="9" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3.5 3.5 0 0 1 0 7M18 14.5c1.8.8 3 2.6 3 5.5" />
  </Icon>
);
export const RupeeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 5h10M7 9h10M7 5c6 0 6 8 0 8h-.5l7.5 7" />
  </Icon>
);
export const AwardIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 2.6 5.6 6 .8-4.4 4.1 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.4l6-.8z" />
  </Icon>
);
export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5a2 2 0 0 1 2-2h11v15H7a2 2 0 0 0-2 2zM5 20a2 2 0 0 0 2 1h11" />
  </Icon>
);
export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z" />
  </Icon>
);
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
  </Icon>
);
