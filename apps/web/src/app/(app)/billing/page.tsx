"use client";
import { CreditCard } from "lucide-react";
import { BillingLive } from "@/components/app/billing-live";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useSession } from "@/components/session-provider";

export default function BillingPage() {
  const { live } = useSession();
  if (live) return <BillingLive />;
  return (
    <>
      <PageHeader eyebrow="Admin only" title="Billing." dim="Your Slov subscription." />
      <EmptyState icon={CreditCard} title="Billing shows up when the school is connected" text="This demo has no subscription to show." />
    </>
  );
}
