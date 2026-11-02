import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cleanRoomNumber, deleteRoom, getHotelData, publicRoom, regenerateRoomToken, updateRoom, validRoomNumber } from "@/lib/hotel-data";
import { appendHistory } from "@/lib/history";
import { getCurrentUser as getUser2 } from "@/lib/auth";
import { foreignOriginResponse } from "@/lib/security";

async function ownerOnly() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Only the Owner can change rooms and QR codes." }, { status: 403 });
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const err = await ownerOnly(); if (err) return err;
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  if (r.action === "regenerate") {
    const room = await regenerateRoomToken(id);
    if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
    const actor = await getUser2();
    await appendHistory({ actorName: actor?.name ?? "Owner", actorRole: actor?.roleLabel ?? "Owner", room: room.number, taskId: null, taskTitle: null, taskType: null, action: "QR regenerated", details: `New QR code for room ${room.number}. The old one no longer works.` });
    return NextResponse.json({ room: publicRoom(room) });
  }
  const number = r.number !== undefined ? cleanRoomNumber(r.number) : undefined;
  if (number !== undefined && !validRoomNumber(number)) return NextResponse.json({ error: "Write a room number like 204 (letters, numbers, dash)." }, { status: 400 });
  const floor = typeof r.floor === "number" ? Math.trunc(r.floor) : undefined;
  const roomType = typeof r.roomType === "string" ? r.roomType : undefined;
  const pricePerNight = typeof r.pricePerNight === "number" ? r.pricePerNight : undefined;
  if (pricePerNight !== undefined && !(pricePerNight >= 0)) return NextResponse.json({ error: "Price per night cannot be negative." }, { status: 400 });
  const notes = typeof r.notes === "string" ? r.notes : undefined;
  const before = (await getHotelData()).rooms.find((x) => x.id === id);
  const result = await updateRoom(id, { number, floor, roomType, pricePerNight, notes });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "Room not found." ? 404 : 409 });
  { const actor = await getUser2(); await appendHistory({ actorName: actor?.name ?? "Owner", actorRole: actor?.roleLabel ?? "Owner", room: result.room.number, taskId: null, taskTitle: null, taskType: null, action: "Rooms changed", details: `Room ${before?.number ?? ""} changed to ${result.room.number}.` }); }
  return NextResponse.json({ room: publicRoom(result.room) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreignOrigin = foreignOriginResponse(_request);
  if (foreignOrigin) return foreignOrigin;
  const err = await ownerOnly(); if (err) return err;
  const { id } = await params;
  const beforeDel = (await getHotelData()).rooms.find((x) => x.id === id);
  const ok = await deleteRoom(id);
  if (!ok) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  { const actor = await getUser2(); await appendHistory({ actorName: actor?.name ?? "Owner", actorRole: actor?.roleLabel ?? "Owner", room: beforeDel?.number ?? null, taskId: null, taskTitle: null, taskType: null, action: "Rooms changed", details: `Room ${beforeDel?.number ?? ""} removed.` }); }
  return NextResponse.json({ ok: true });
}
