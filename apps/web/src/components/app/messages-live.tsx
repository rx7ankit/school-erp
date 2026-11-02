"use client";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { LiveBroadcastForm, LiveBroadcastList } from "@/components/app/messages-live-broadcast";
import { LiveChats } from "@/components/app/messages-live-chats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/components/session-provider";
import { useThreads, useUnreadMessages } from "@/lib/api/hooks/messaging";

/** Staff messages on the real API: broadcasts to parents, and private threads with a parent. */
export function MessagesLive() {
  const { me } = useSession();
  const unread = useUnreadMessages(true).data?.messages ?? 0;
  const threads = useThreads();
  if (!me) return null;
  const manager = me.is_admin || me.permissions.includes("academic.manage");
  const teaches = me.assignments.length > 0;
  // Someone who no longer teaches anywhere can still read the conversations they had.
  if (!manager && !teaches) {
    if (threads.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
    if (!threads.data?.items.length) return <NoAccess need="a class assignment" />;
  }
  const canBroadcast = manager || teaches;
  return (
    <>
      <PageHeader title="Messages." />
      <Tabs defaultValue={canBroadcast ? "broadcast" : "chats"}>
        <TabsList>{canBroadcast && <TabsTrigger value="broadcast">Broadcast</TabsTrigger>}<TabsTrigger value="chats">Chats{unread > 0 ? ` (${unread})` : ""}</TabsTrigger></TabsList>
        {canBroadcast && <TabsContent value="broadcast" className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:items-start">
          <LiveBroadcastForm me={me} />
          <LiveBroadcastList />
        </TabsContent>}
        <TabsContent value="chats"><LiveChats me={me} /></TabsContent>
      </Tabs>
    </>
  );
}
