import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { countWaitingConversations, listOpenConversations } from "@/lib/conversations";

export const HANDOFF_ROLES = ["front_desk", "supervisor", "owner"] as const;

export async function guardHandoff() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in to do this." }, { status: 401 }) };
  if (!(HANDOFF_ROLES as readonly string[]).includes(user.role)) {
    return { error: NextResponse.json({ error: "Only the front desk, a supervisor or the Owner can open Guest messages." }, { status: 403 }) };
  }
  return { user };
}

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
