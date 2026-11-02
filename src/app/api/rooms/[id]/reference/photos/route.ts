import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  MAX_REFERENCE_PHOTOS,
  REFERENCE_LABELS,
  getHotelData,
  publicRoom,
  setPendingReference,
  type ReferenceLabel,
  type ReferenceRecord,
} from "@/lib/hotel-data";
import {
  MAX_PHOTO_BYTES,
  PHOTO_FORMAT_MESSAGE,
  PhotoFormatError,
  deletePhoto,
  isAcceptedPhotoUpload,
  readPhotoDataUrl,
  savePhoto,
} from "@/lib/photos";
import { runReferenceCheck } from "@/lib/photo-check";
import { randomUUID } from "crypto";
import { appendHistory } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";

// Upload runs the perfect-photo AI check, which can take ~15s.
export const maxDuration = 60;

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in to do this." }, { status: 401 as const }) };
  if (user.role !== "owner" && user.role !== "supervisor")
    return { error: NextResponse.json({ error: "Only the Owner or Supervisor can add perfect room photos." }, { status: 403 as const }) };
  return { user };
}

async function roomOr404(id: string) {
  const data = await getHotelData();
  return data.rooms.find((r) => r.id === id) ?? null;
}

/** Run (or re-run) the cached check for pending photos and save it. */
async function checkPending(roomId: string, pending: ReferenceRecord): Promise<ReferenceRecord> {
  const dataUrls: string[] = [];
  for (const photo of pending.photos) {
    const dataUrl = await readPhotoDataUrl(photo.name);
    if (dataUrl) dataUrls.push(dataUrl);
  }
  let checked: ReferenceRecord = pending;
  try {
    const result = await runReferenceCheck(dataUrls);
    checked = { ...pending, items: result.items, itemSource: result.itemSource, checkedAt: new Date().toISOString(), checkFailed: false };
  } catch (error) {
    // PC1: a failed LIVE check is saved as failed — never as a fake MOCK
    // success. The screen shows "Try again" and blocks approval.
    console.error("Reference check failed:", error instanceof Error ? error.message : "unknown error");
    checked = { ...pending, items: [], itemSource: pending.itemSource, checkedAt: new Date().toISOString(), checkFailed: true };
  }
  await setPendingReference(roomId, checked);
  return checked;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await params;
  const room = await roomOr404(id);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Please send the photo as form data (field name: photo)." }, { status: 400 }); }
  const file = form.get("photo");
  const labelRaw = form.get("label");
  const label: ReferenceLabel = REFERENCE_LABELS.includes(labelRaw as ReferenceLabel) ? (labelRaw as ReferenceLabel) : "Other";
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No photo received. Please choose a photo and try again." }, { status: 400 });
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "That photo is too big (max 10 MB). Please try again." }, { status: 413 });

  const replaceNameRaw = form.get("replaceName");
  const replaceName = typeof replaceNameRaw === "string" && replaceNameRaw ? replaceNameRaw : null;
  const existing = room.pendingReference;
  if (replaceName && (!existing || !existing.photos.some((p) => p.name === replaceName))) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }
  if (!replaceName && existing && existing.photos.length >= MAX_REFERENCE_PHOTOS) {
    return NextResponse.json({ error: `A perfect room set has at most ${MAX_REFERENCE_PHOTOS} photos. Remove one first.` }, { status: 409 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!isAcceptedPhotoUpload(bytes, file.type, file.name)) {
    return NextResponse.json({ error: PHOTO_FORMAT_MESSAGE }, { status: 415 });
  }
  let saved;
  try {
    // HEIC/HEIF is converted to JPEG and resized inside savePhoto (PC1).
    saved = await savePhoto(`ref-${room.id}`, bytes, file.type, file.name);
  } catch (error) {
    if (error instanceof PhotoFormatError) {
      return NextResponse.json({ error: PHOTO_FORMAT_MESSAGE }, { status: 415 });
    }
    throw error;
  }
  const now = new Date().toISOString();
  let pending: ReferenceRecord;
  if (existing && replaceName) {
    pending = { ...existing, photos: existing.photos.map((p) => (p.name === replaceName ? { ...saved, label } : p)), items: [], checkedAt: null, uploadedAt: now };
    await deletePhoto(replaceName);
  } else if (existing) {
    pending = { ...existing, photos: [...existing.photos, { ...saved, label }], items: [], checkedAt: null, uploadedAt: now };
  } else {
    pending = {
        id: randomUUID(),
        photos: [{ ...saved, label }],
        items: [], itemSource: "mock", checkedAt: null,
        uploadedBy: g.user.name, uploadedByRole: g.user.roleLabel, uploadedAt: now, reason: null, copiedFromRoom: null,
      };
  }
  await setPendingReference(room.id, pending);
  // Spec: right after upload, run the check on the perfect photo(s).
  await checkPending(room.id, pending);
  await appendHistory({ actorName: g.user.name, actorRole: g.user.roleLabel, room: room.number, taskId: null, taskTitle: null, taskType: null, action: replaceName ? "Reference photo replaced" : "Reference photo added", details: `Perfect room photo (${label}) ${replaceName ? "replaced" : "added"} for room ${room.number} by ${g.user.name}. Not active until set as the reference.` });
  const fresh = await roomOr404(room.id);
  return NextResponse.json({ room: fresh ? publicRoom(fresh) : null }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await params;
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const room = await roomOr404(id);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  const pending = room.pendingReference;
  if (!pending || !pending.photos.some((p) => p.name === name)) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }
  const remaining = pending.photos.filter((p) => p.name !== name);
  await deletePhoto(name);
  if (remaining.length === 0) {
    const { clearPendingReference } = await import("@/lib/hotel-data");
    await clearPendingReference(room.id);
  } else {
    const next: ReferenceRecord = { ...pending, photos: remaining, items: [], checkedAt: null };
    await setPendingReference(room.id, next);
    await checkPending(room.id, next);
  }
  const fresh = await roomOr404(room.id);
  return NextResponse.json({ room: fresh ? publicRoom(fresh) : null });
}
