"use client";
import { ParentMessages } from "@/components/app/messages/parent-messages";
import { MessagesLive } from "@/components/parent/messages-live";
import { isLive } from "@/lib/api/config";

export default function ParentMessagesPage() {
  return isLive ? <MessagesLive /> : <ParentMessages />;
}
