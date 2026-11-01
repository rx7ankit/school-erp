"use client";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { BroadcastForm } from "@/components/app/messages/broadcast-form";
import { BroadcastList } from "@/components/app/messages/broadcast-list";
import { StaffChats } from "@/components/app/messages/staff-chats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/components/session-provider";
import { hasAccess } from "@/lib/permissions";

export default function MessagesPage() {
  const { user } = useSession();
  if (!user || !hasAccess(user, "assigned_class")) return <NoAccess need="a class assignment" />;
  return (
    <>
      <PageHeader eyebrow="Parents" title="Messages." dim="Broadcast to parents or write to one." />
      <Tabs defaultValue="broadcast">
        <TabsList><TabsTrigger value="broadcast">Broadcast</TabsTrigger><TabsTrigger value="chats">Chats</TabsTrigger></TabsList>
        <TabsContent value="broadcast" className="grid gap-4 lg:grid-cols-[380px_1fr] lg:items-start">
          <BroadcastForm user={user} />
          <BroadcastList user={user} />
        </TabsContent>
        <TabsContent value="chats"><StaffChats user={user} /></TabsContent>
      </Tabs>
    </>
  );
}
