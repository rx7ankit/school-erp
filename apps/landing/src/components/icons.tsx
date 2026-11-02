import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0", className ?? "size-5")}
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
export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4" />
  </Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);
export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </Icon>
);
export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12 20 4l-4 16-4.5-6.5z" />
    <path d="m11.5 13.5 4-4" />
  </Icon>
);
export const ReceiptIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
  </Icon>
);
export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.8" />
    <path d="M10.5 18.5h3" />
  </Icon>
);
export const SchoolIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10 12 4l9 6M5 10v9h14v-9M9 19v-5h6v5" />
  </Icon>
);
