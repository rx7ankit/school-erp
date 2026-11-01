"use client";

import { BellIcon, CheckIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Mockup } from "./parts";

const TONES = ["text-success", "text-danger", "text-warning", "text-accent", "text-text-secondary"] as const;

/** Phone lock-screen style list of parent notifications, with a receipt PDF card. */
export function NotificationsMockup() {
  const n = useT().mock.notify;
  return (
    <Mockup className="mx-auto w-full max-w-[460px]">
      <div className="rounded-[24px] bg-bg p-4">
        <div className="mb-3 flex items-center gap-2 px-1 text-[12px] font-bold">
          <BellIcon className="size-4" />
          {n.title}
        </div>
        <div className="flex flex-col gap-2">
          {n.items.map((item, index) => (
            <div key={item.body} className="flex items-start gap-3 rounded-[18px] bg-card p-3.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] bg-bg">
                <span className={cn("size-2.5 rounded-full bg-current", TONES[index])} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-text-secondary">{item.title}</p>
                  <p className="shrink-0 text-[10px] text-text-tertiary">{item.when}</p>
                </div>
                <p className="mt-0.5 text-[13px] font-semibold leading-[1.35]">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-card p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-bg text-success">
            <CheckIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold">{n.receipt}</p>
            <p className="truncate text-[10px] text-text-tertiary">{n.receiptMeta}</p>
          </div>
          <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-solid px-3.5 text-[11px] font-semibold text-on-solid">{n.download}</span>
        </div>
      </div>
    </Mockup>
  );
}
