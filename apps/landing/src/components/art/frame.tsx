import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Rounded image slot. Renders the real photo when `photo` (a path under /images/...) is given,
 * otherwise the in-code illustration passed as children. Same frame either way.
 */
export function ImageFrame({
  photo,
  alt,
  className,
  sizes = "(min-width: 768px) 33vw, 100vw",
  children,
}: {
  photo?: string;
  alt: string;
  className?: string;
  sizes?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-[28px] bg-card", className)}>
      {photo ? <Image src={photo} alt={alt} fill sizes={sizes} className="object-cover" /> : children}
    </div>
  );
}

/** Shared <svg> wrapper for scenes: fills its frame, crops (never stretches) when the frame ratio differs. */
export function SceneSvg({
  viewBox,
  label,
  children,
  align = "xMidYMid",
  className,
}: {
  viewBox: string;
  label?: string;
  children: ReactNode;
  align?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={`${align} slice`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("absolute inset-0 size-full", className)}
    >
      {children}
    </svg>
  );
}
