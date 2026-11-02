import { NextResponse } from "next/server";
import { appendGuestMessage, guestConversationView, getConversation, startConversation } from "@/lib/conversations";
import { getHotelData } from "@/lib/hotel-data";
import { appendHistory } from "@/lib/history";
import { GUEST_COOKIE, checkRateLimit, clientIp, createGuestToken, foreignOriginResponse, guestCookieOptions, guestDataFromToken, rateLimitResponse, type GuestTokenData } from "@/lib/security";

function existingGuest(request: Request): GuestTokenData | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === GUEST_COOKIE) return guestDataFromToken(decodeURIComponent(rest.join("=")));
  }
  return null;
}

function withGuestCookie(request: Request, room: string, conversationId: string | null, body: Record<string, unknown>): NextResponse {
  const previous = existingGuest(request);
  const taskIds = previous && previous.room === room ? previous.taskIds : [];
  const response = NextResponse.json(body);
  response.cookies.set(GUEST_COOKIE, createGuestToken(room, taskIds, conversationId), guestCookieOptions());
  return response;
}

/** The guest's open conversation survives a page refresh via the signed guest cookie. A closed one is never shown again. */
export async function GET(request: Request) {
  const guest = existingGuest(request);
  if (!guest?.conversationId) return NextResponse.json({ conversation: null });
  const conversation = await getConversation(guest.conversationId);
  if (!conversation || conversation.room !== guest.room) return NextResponse.json({ conversation: null });
  if (conversation.status === "closed") {
    return withGuestCookie(request, guest.room, null, { conversation: null, closed: true, endReason: conversation.endReason });
  }
  const { hotelInfo } = await getHotelData();
  return NextResponse.json({ conversation: guestConversationView(conversation, hotelInfo.receptionPhone) });
}

/** POST {room} starts a handoff (the button); POST {message} writes to the open conversation (the AI stays silent). */
export async function POST(request: Request) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const record = (body ?? {}) as Record<string, unknown>;
  const guest = existingGuest(request);
  const room = typeof record.room === "string" && record.room.trim() ? record.room.trim().slice(0, 20) : guest?.room ?? "204";
  const text = typeof record.message === "string" ? record.message.trim().slice(0, 2000) : "";

  // Per-IP limit kept (SEC1); the per-room chat limit lives in part 4's helper use below.
  const ip = clientIp(request);
  if (!checkRateLimit(`guest-text:ip:${ip}`, 10)) return rateLimitResponse();

  if (text && guest?.conversationId) {
    const updated = await appendGuestMessage(guest.conversationId, text);
    if (updated && updated.status !== "closed") {
      const { hotelInfo } = await getHotelData();
      return withGuestCookie(request, room, updated.id, { conversation: guestConversationView(updated, hotelInfo.receptionPhone) });
    }
  }

  const { conversation, created } = await startConversation(room, "Guest pressed Talk to a person", text || undefined, text ? undefined : "I've asked the front desk to join this chat.");
  if (created) {
    await appendHistory({ actorName: "Guest", actorRole: "Guest", room, taskId: null, taskTitle: null, taskType: null, action: "Handoff started", details: `Handoff started for room ${room} (guest asked for a person).` });
  }
  const { hotelInfo } = await getHotelData();
  return withGuestCookie(request, room, conversation.id, { conversation: guestConversationView(conversation, hotelInfo.receptionPhone), created });
}
