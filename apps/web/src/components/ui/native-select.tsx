"use client";
import * as React from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drop-in replacement for a native <select>: same props (<option> children, value / defaultValue, onChange with
 * e.target.value, name, id, disabled), but the list is a custom panel that floats above the page with a soft shadow and
 * eases open. Radix Select supplies keyboard, type-to-search, screen reader and mobile behaviour.
 */
type Opt = { value: string; label: React.ReactNode; disabled?: boolean };
// Radix does not allow an empty item value, so "" travels as a sentinel.
const EMPTY = "__empty__";
const enc = (v: string) => (v === "" ? EMPTY : v);
const dec = (v: string) => (v === EMPTY ? "" : v);

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}
function collect(children: React.ReactNode, out: Opt[] = []): Opt[] {
  React.Children.forEach(children, (c) => {
    if (!React.isValidElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>(c)) return;
    if (c.type === "option") {
      const label = c.props.children;
      out.push({ value: c.props.value != null ? String(c.props.value) : textOf(label), label, disabled: c.props.disabled });
    } else collect(c.props.children, out); // fragments and <optgroup>
  });
  return out;
}

type Props = Omit<React.ComponentProps<"select">, "onChange" | "value" | "defaultValue"> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};

function NativeSelect({ className, children, value, defaultValue, onChange, name, id, disabled, required, ...rest }: Props) {
  const options = collect(children);
  const ariaLabel = rest["aria-label"];
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(() => String(defaultValue ?? options[0]?.value ?? ""));
  const current = controlled ? String(value) : inner;
  const known = options.some((o) => o.value === current);
  const [open, setOpen] = React.useState(false);

  function pick(v: string) {
    const next = dec(v);
    if (!controlled) setInner(next);
    // Callers only read e.target.value / e.currentTarget.value.
    onChange?.({ target: { value: next, name }, currentTarget: { value: next, name } } as unknown as React.ChangeEvent<HTMLSelectElement>);
  }

  return (
    <div className={cn("relative", className)}>
      <S.Root value={known ? enc(current) : undefined} onValueChange={pick} open={open} onOpenChange={setOpen} name={name} disabled={disabled} required={required}>
        <S.Trigger
          id={id}
          aria-label={ariaLabel}
          data-slot="select-trigger"
          className="flex h-10 w-full items-center rounded-xl border-0 bg-fill pl-4 pr-10 text-left text-sm text-foreground outline-none transition-colors hover:bg-separator/40 focus-visible:bg-separator/50 data-[state=open]:bg-separator/50 disabled:opacity-50"
        >
          <span className="min-w-0 flex-1 truncate"><S.Value placeholder={<span className="text-text-tertiary">&nbsp;</span>} /></span>
        </S.Trigger>
        <ChevronDown aria-hidden className={cn("pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary transition-transform duration-200 ease-out", open && "rotate-180")} />
        <S.Portal>
          <S.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            data-slot="select-content"
            className="select-pop z-50 max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground"
          >
            <S.Viewport className="p-1.5">
              {options.map((o) => (
                <S.Item
                  key={o.value}
                  value={enc(o.value)}
                  disabled={o.disabled}
                  className="relative flex min-h-9 cursor-pointer select-none items-center rounded-xl py-2 pl-3 pr-9 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-fill data-[state=checked]:font-medium"
                >
                  <S.ItemText>{o.label}</S.ItemText>
                  <S.ItemIndicator className="absolute right-3 inline-flex"><Check className="size-4" /></S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </div>
  );
}
export { NativeSelect };
