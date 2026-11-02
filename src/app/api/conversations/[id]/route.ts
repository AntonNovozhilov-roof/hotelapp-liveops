import { NextResponse } from "next/server";
import { appendStaffMessage, closeConversation, getConversation, handBackConversation, joinConversation } from "@/lib/conversations";
import { appendHistory } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";
import { guardHandoff } from "../route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardHandoff();
  if (g.error) return g.error;
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ conversation });
}

/** Actions: join | reply {text} | handback | close. History records only who did it, never the text. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const g = await guardHandoff();
  if (g.error) return g.error;
  const user = g.user!;
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const record = (body ?? {}) as Record<string, unknown>;
  const action = typeof record.action === "string" ? record.action : "";
  const before = await getConversation(id);
  if (!before) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  if (action === "join") {
    const wasWaiting = before.status === "waiting";
    const conversation = await joinConversation(id, user.name, user.roleLabel);
    if (wasWaiting && conversation?.status === "with_human") {
      await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: before.room, taskId: null, taskTitle: null, taskType: null, action: "Handoff joined", details: `Handoff for room ${before.room} joined by ${user.name}.` });
    }
    return NextResponse.json({ conversation });
  }
  if (action === "reply") {
    const text = typeof record.text === "string" ? record.text.trim().slice(0, 2000) : "";
    if (!text) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });
    const wasWaiting = before.status === "waiting";
    const conversation = await appendStaffMessage(id, user.name, user.roleLabel, text);
    if (wasWaiting && conversation?.status === "with_human") {
      await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: before.room, taskId: null, taskTitle: null, taskType: null, action: "Handoff joined", details: `Handoff for room ${before.room} joined by ${user.name}.` });
    }
    return NextResponse.json({ conversation });
  }
  if (action === "handback" || action === "close") {
    const conversation = action === "handback" ? await handBackConversation(id, user.name) : await closeConversation(id, user.name);
    if (conversation?.status === "closed") {
      await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: before.room, taskId: null, taskTitle: null, taskType: null, action: action === "handback" ? "Handoff handed back" : "Handoff closed", details: `Handoff for room ${before.room} ${action === "handback" ? "handed back to the assistant" : "closed"} by ${user.name}.` });
    }
    return NextResponse.json({ conversation });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
