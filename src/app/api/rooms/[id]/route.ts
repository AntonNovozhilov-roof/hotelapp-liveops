import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cleanRoomNumber, deleteRoom, publicRoom, regenerateRoomToken, updateRoom, validRoomNumber } from "@/lib/hotel-data";

async function ownerOnly() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Only the Owner can change rooms and QR codes." }, { status: 403 });
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await ownerOnly(); if (err) return err;
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  if (r.action === "regenerate") {
    const room = await regenerateRoomToken(id);
    if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
    return NextResponse.json({ room: publicRoom(room) });
  }
  const number = r.number !== undefined ? cleanRoomNumber(r.number) : undefined;
  if (number !== undefined && !validRoomNumber(number)) return NextResponse.json({ error: "Write a room number like 204 (letters, numbers, dash)." }, { status: 400 });
  const floor = typeof r.floor === "number" ? Math.trunc(r.floor) : undefined;
  const result = await updateRoom(id, { number, floor });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "Room not found." ? 404 : 409 });
  return NextResponse.json({ room: publicRoom(result.room) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await ownerOnly(); if (err) return err;
  const { id } = await params;
  const ok = await deleteRoom(id);
  if (!ok) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
