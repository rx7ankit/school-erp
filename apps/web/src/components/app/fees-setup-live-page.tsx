"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ClassFeesTab, ConcessionsTab, HeadsTab, TransportTab } from "@/components/app/fees-setup-live";
import { GenerateTab, LateFeeTab, OpeningTab, SettingsTab } from "@/components/app/fees-setup-live2";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Fees setup on the real API. */
export function FeesSetupLive() {
  return (
    <>
      <PageHeader title="Fee setup."
        actions={<Button variant="secondary" asChild><Link href="/fees"><ArrowLeft /> Fees</Link></Button>} />
      <Tabs defaultValue="heads">
        <TabsList>
          <TabsTrigger value="heads">Heads</TabsTrigger><TabsTrigger value="classes">Classes</TabsTrigger><TabsTrigger value="transport">Transport</TabsTrigger>
          <TabsTrigger value="concessions">Concessions</TabsTrigger><TabsTrigger value="late">Late</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="generate">Invoices</TabsTrigger><TabsTrigger value="opening">Opening</TabsTrigger>
        </TabsList>
        <TabsContent value="heads"><HeadsTab /></TabsContent>
        <TabsContent value="classes"><ClassFeesTab /></TabsContent>
        <TabsContent value="transport"><TransportTab /></TabsContent>
        <TabsContent value="concessions"><ConcessionsTab /></TabsContent>
        <TabsContent value="late"><LateFeeTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="generate"><GenerateTab /></TabsContent>
        <TabsContent value="opening"><OpeningTab /></TabsContent>
      </Tabs>
    </>
  );
}
