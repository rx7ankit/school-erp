"use client";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { LiveBroadcastForm, LiveBroadcastList } from "@/components/app/messages-live-broadcast";
import { LiveChats } from "@/components/app/messages-live-chats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/components/session-provider";
import { useUnreadMessages } from "@/lib/api/hooks/messaging";

/** Staff messages on the real API: broadcasts to parents, and private threads with a parent. */
export function MessagesLive() {
  const { me } = useSession();
  const unread = useUnreadMessages(true).data?.messages ?? 0;
  if (!me) return null;
  const manager = me.is_admin || me.permissions.includes("academic.manage");
  if (!manager && me.assignments.length === 0) return <NoAccess need="a class assignment" />;
  return (
    <>
      <PageHeader eyebrow="Parents" title="Messages." dim="Broadcast to parents or write to one." />
      <Tabs defaultValue="broadcast">
        <TabsList><TabsTrigger value="broadcast">Broadcast</TabsTrigger><TabsTrigger value="chats">Chats{unread > 0 ? ` (${unread})` : ""}</TabsTrigger></TabsList>
        <TabsContent value="broadcast" className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:items-start">
          <LiveBroadcastForm me={me} />
          <LiveBroadcastList />
        </TabsContent>
        <TabsContent value="chats"><LiveChats me={me} /></TabsContent>
      </Tabs>
    </>
  );
}
