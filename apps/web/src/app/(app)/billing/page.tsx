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
      <PageHeader title="Billing." />
      <EmptyState icon={CreditCard} title="No subscription" />
    </>
  );
}
