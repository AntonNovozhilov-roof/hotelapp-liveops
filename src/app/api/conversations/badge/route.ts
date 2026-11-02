import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { countWaitingConversations } from "@/lib/conversations";
import { HANDOFF_ROLES } from "@/lib/handoff-auth";

/** Red nav badge count: open conversations still waiting for a person. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(HANDOFF_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ waiting: 0 });
  }
  return NextResponse.json({ waiting: await countWaitingConversations() });
}
