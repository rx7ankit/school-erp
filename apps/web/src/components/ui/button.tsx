import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-solid text-on-solid hover:bg-solid-hover",
        accent: "bg-brand text-brand-foreground hover:bg-accent-hover",
        brand: "bg-solid text-on-solid hover:bg-solid-hover",
        secondary: "bg-fill text-foreground hover:bg-separator",
        ghost: "text-foreground hover:bg-card",
        link: "text-foreground px-0 underline underline-offset-4 hover:text-muted-foreground",
        destructive: "bg-destructive text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-4",
        default: "h-10 px-5",
        lg: "h-12 px-7 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & {
  asChild?: boolean;
  /** Shows a spinner and blocks clicks while work is in progress. */
  loading?: boolean;
};

function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }), loading && "pointer-events-none")}
      {...props}
    >
      {asChild ? children : (<>
        {loading && <Spinner />}
        {children}
      </>)}
    </Comp>
  );
}

export { Button, buttonVariants };
