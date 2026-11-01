"use client";

import { useT } from "@/lib/i18n";

export function SkipText() {
  return <>{useT().common.skip}</>;
}
