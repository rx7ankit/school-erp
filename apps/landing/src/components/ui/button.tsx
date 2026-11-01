import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "accent" | "solid" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  accent: "bg-accent font-semibold text-on-accent hover:bg-accent-hover",
  solid: "bg-solid text-on-solid hover:bg-solid-hover",
  secondary: "bg-fill text-text hover:bg-separator",
  ghost: "text-text hover:bg-card",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-[52px] px-7 text-[16px]",
};

export function buttonClass(variant: Variant = "solid", size: Size = "md", className?: string): string {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks clicks while work is in progress. */
  loading?: boolean;
};

export function Button({ variant, size, loading = false, disabled, className, children, ...props }: ButtonProps) {
  return (
    <button
      data-slot="button"
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={buttonClass(variant, size, cn(loading && "pointer-events-none", className))}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type ButtonLinkProps = {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

/** A link that looks and presses like a button. */
export function ButtonLink({ href, variant, size, className, children }: ButtonLinkProps) {
  return (
    <Link href={href} data-slot="button" className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
