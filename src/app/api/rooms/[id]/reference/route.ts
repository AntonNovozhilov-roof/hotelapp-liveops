import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { approvePendingReference, getHotelData, publicRoom } from "@/lib/hotel-data";
import { appendHistory } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";

/** Set the pending perfect photos as the room's active reference (P1). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner" && user.role !== "supervisor") {
    return NextResponse.json({ error: "Only the Owner or Supervisor can set perfect room photos." }, { status: 403 });
  }
  const { id } = await params;
  let body: unknown = {};
  try { body = await request.json(); } catch { /* reason is optional */ }
  const reasonRaw = (body as Record<string, unknown>)?.reason;
  const reason = typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw.trim().slice(0, 300) : null;

  const data = await getHotelData();
  const room = data.rooms.find((r) => r.id === id);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (!room.pendingReference) return NextResponse.json({ error: "Add a perfect photo first, then set it as the reference." }, { status: 409 });
  if (!room.pendingReference.checkedAt) return NextResponse.json({ error: "The AI check is still running on these photos. Please wait and try again." }, { status: 409 });

  const result = await approvePendingReference(id, reason);
  if (!result) return NextResponse.json({ error: "Add a perfect photo first, then set it as the reference." }, { status: 409 });
  await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: result.room.number, taskId: null, taskTitle: null, taskType: null, action: result.archived ? "Reference replaced" : "Reference approved", details: result.archived ? `Perfect reference for room ${result.room.number} replaced by ${user.name}${reason ? `: ${reason}` : ""}. The old one was archived.` : `Perfect reference for room ${result.room.number} set by ${user.name}.` });
  return NextResponse.json({ room: publicRoom(result.room), replaced: Boolean(result.archived) });
}
