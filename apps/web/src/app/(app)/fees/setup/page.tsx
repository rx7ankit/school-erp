"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { useCan } from "@/components/app/can";
import { ClassFeesTab } from "@/components/app/fees/class-fees-tab";
import { ConcessionsTab } from "@/components/app/fees/concessions-tab";
import { GenerateTab } from "@/components/app/fees/generate-tab";
import { HeadsTab } from "@/components/app/fees/heads-tab";
import { LateFeeTab } from "@/components/app/fees/late-fee-tab";
import { useSession } from "@/components/session-provider";
import { isLive } from "@/lib/api/config";
import { FeesSetupLive } from "@/components/app/fees-setup-live-page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FeesSetupPage() {
  const can = useCan();
  if (!can("fees.manage")) return <NoAccess need="the Fees permission" />;
  return isLive ? <FeesSetupLive /> : <Content />;
}

function Content() {
  const { user } = useSession();
  const by = user?.name ?? "Staff";
  return (
    <>
      <PageHeader title="Fee setup."
        actions={<Button variant="secondary" asChild><Link href="/fees"><ArrowLeft /> Fees</Link></Button>} />
      <Tabs defaultValue="heads">
        <TabsList>
          <TabsTrigger value="heads">Heads</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="concessions">Concessions</TabsTrigger>
          <TabsTrigger value="late">Late</TabsTrigger>
          <TabsTrigger value="generate">Invoices</TabsTrigger>
        </TabsList>
        <TabsContent value="heads"><HeadsTab /></TabsContent>
        <TabsContent value="classes"><ClassFeesTab /></TabsContent>
        <TabsContent value="concessions"><ConcessionsTab by={by} /></TabsContent>
        <TabsContent value="late"><LateFeeTab /></TabsContent>
        <TabsContent value="generate"><GenerateTab by={by} /></TabsContent>
      </Tabs>
    </>
  );
}
