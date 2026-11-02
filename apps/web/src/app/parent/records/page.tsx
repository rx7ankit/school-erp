"use client";
import { RecordsLive } from "@/components/parent/records-live";
import { isLive } from "@/lib/api/config";
import { useRouter } from "next/navigation";
import * as React from "react";

/** Certificates and library loans: real data only, so this page exists in live mode alone. */
export default function ParentRecords() {
  const router = useRouter();
  React.useEffect(() => { if (!isLive) router.replace("/parent"); }, [router]);
  return isLive ? <RecordsLive /> : null;
}
