import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { copyReferenceToRooms, getHotelData, publicRoom } from "@/lib/hotel-data";
import { appendHistory } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";

/** P2: copy this room's approved perfect photos + AI result to same-type rooms. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner" && user.role !== "supervisor") return NextResponse.json({ error: "Only the Owner or Supervisor can copy perfect room photos." }, { status: 403 });
  const { id } = await params;
  let body: unknown = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const targetIdsRaw = (body as Record<string, unknown>)?.targetIds;
  const targetIds = Array.isArray(targetIdsRaw) ? targetIdsRaw.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  if (!targetIds.length) return NextResponse.json({ error: "Pick at least one room to copy to." }, { status: 400 });
  const data = await getHotelData();
  const source = data.rooms.find((r) => r.id === id);
  if (!source) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (!source.reference) return NextResponse.json({ error: "Set this room's perfect reference first, then copy it." }, { status: 409 });
  const result = await copyReferenceToRooms(id, targetIds, user.name, user.roleLabel);
  if (!result) return NextResponse.json({ error: "Set this room's perfect reference first, then copy it." }, { status: 409 });
  for (const room of result.copied) {
    await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: room.number, taskId: null, taskTitle: null, taskType: null, action: "Reference copied", details: `Perfect photos copied from room ${source.number} to room ${room.number} by ${user.name}.` });
  }
  const fresh = await getHotelData();
  return NextResponse.json({ copied: result.copied.map((r) => r.number), skipped: result.skipped, rooms: fresh.rooms.map(publicRoom) });
}
