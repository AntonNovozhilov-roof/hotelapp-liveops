import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData, publicRoom, setPendingReference, type ReferenceRecord } from "@/lib/hotel-data";
import { readPhoto, readPhotoDataUrl, savePhoto } from "@/lib/photos";
import { runReferenceCheck } from "@/lib/photo-check";
import { appendHistory } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";

/** P2: start editing the active reference — copies its files into a new pending set. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner" && user.role !== "supervisor") return NextResponse.json({ error: "Only the Owner or Supervisor can edit perfect room photos." }, { status: 403 });
  const { id } = await params;
  const data = await getHotelData();
  const room = data.rooms.find((r) => r.id === id);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.pendingReference) return NextResponse.json({ room: publicRoom(room) });
  if (!room.reference) return NextResponse.json({ error: "Add a perfect photo first." }, { status: 409 });

  const now = new Date().toISOString();
  const photos = [];
  for (const ph of room.reference.photos) {
    const stored = await readPhoto(ph.name);
    if (!stored) continue;
    const saved = await savePhoto(`ref-${room.id}`, stored.bytes, stored.contentType);
    photos.push({ ...saved, label: ph.label });
  }
  if (!photos.length) return NextResponse.json({ error: "The saved perfect photos are missing. Add new photos instead." }, { status: 409 });
  let pending: ReferenceRecord = { id: randomUUID(), photos, items: [], itemSource: "mock", checkedAt: null, uploadedBy: user.name, uploadedByRole: user.roleLabel, uploadedAt: now, reason: null, copiedFromRoom: null };
  try {
    const dataUrls: string[] = [];
    for (const photo of pending.photos) {
      const dataUrl = await readPhotoDataUrl(photo.name);
      if (dataUrl) dataUrls.push(dataUrl);
    }
    const result = await runReferenceCheck(dataUrls);
    pending = { ...pending, items: result.items, itemSource: result.itemSource, checkedAt: new Date().toISOString(), checkFailed: false };
  } catch { pending = { ...pending, checkedAt: new Date().toISOString(), checkFailed: true }; }
  await setPendingReference(room.id, pending);
  await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: room.number, taskId: null, taskTitle: null, taskType: null, action: "Reference photo added", details: `Editing perfect photos for room ${room.number} started by ${user.name} from the current reference.` });
  const fresh = (await getHotelData()).rooms.find((r) => r.id === id);
  return NextResponse.json({ room: fresh ? publicRoom(fresh) : null });
}
