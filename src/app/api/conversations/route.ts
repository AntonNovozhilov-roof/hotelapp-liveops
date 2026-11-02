import { NextResponse } from "next/server";
import { countWaitingConversations, listOpenConversations } from "@/lib/conversations";
import { guardHandoff } from "@/lib/handoff-auth";

/** Open conversations for staff: newest waiting first (list computed in the store). */
export async function GET() {
  const g = await guardHandoff();
  if (g.error) return g.error;
  const conversations = await listOpenConversations();
  return NextResponse.json({
    waiting: await countWaitingConversations(),
    conversations: conversations.map((c) => ({
      id: c.id, room: c.room, status: c.status, staffName: c.staffName,
      createdAt: c.createdAt, updatedAt: c.updatedAt,
      waitingSeconds: Math.max(0, Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 1000)),
      lastMessage: c.messages[c.messages.length - 1] ?? null,
      messageCount: c.messages.length,
    })),
  });
}
