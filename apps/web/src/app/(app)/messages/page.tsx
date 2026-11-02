"use client";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { BroadcastForm } from "@/components/app/messages/broadcast-form";
import { BroadcastList } from "@/components/app/messages/broadcast-list";
import { StaffChats } from "@/components/app/messages/staff-chats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/components/session-provider";
import { hasAccess } from "@/lib/permissions";
import { MessagesLive } from "@/components/app/messages-live";

export default function MessagesPage() {
  const { user, live } = useSession();
  if (live) return <MessagesLive />;
  if (!user || !hasAccess(user, "assigned_class")) return <NoAccess need="a class assignment" />;
  return (
    <>
      <PageHeader title="Messages." />
      <Tabs defaultValue="broadcast">
        <TabsList><TabsTrigger value="broadcast">Broadcast</TabsTrigger><TabsTrigger value="chats">Chats</TabsTrigger></TabsList>
        <TabsContent value="broadcast" className="grid gap-4 grid-cols-1 lg:grid-cols-[380px_1fr] lg:items-start">
          <BroadcastForm user={user} />
          <BroadcastList user={user} />
        </TabsContent>
        <TabsContent value="chats"><StaffChats user={user} /></TabsContent>
      </Tabs>
    </>
  );
}
