import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addRoomsBulk, addSingleRoom, cleanRoomNumber, getHotelData, publicRoom, validRoomNumber } from "@/lib/hotel-data";
import { appendHistory } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";

async function guard(viewOnly = false) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in to do this." }, { status: 401 }) };
  if (user.role !== "owner" && user.role !== "supervisor") return { error: NextResponse.json({ error: "Only the Owner or Supervisor can open Rooms & QR." }, { status: 403 }) };
  if (!viewOnly && user.role !== "owner") return { error: NextResponse.json({ error: "Only the Owner can change rooms and QR codes." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const g = await guard(true);
  if (g.error) return g.error;
  const data = await getHotelData();
  return NextResponse.json({ rooms: data.rooms.map(publicRoom), settings: data.settings, hotelInfo: { hotelName: data.hotelInfo.hotelName }, canEdit: g.user?.role === "owner", canReference: true });
}

export async function POST(request: Request) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const g = await guard(false);
  if (g.error) return g.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  // Single room
  if (typeof r.number === "string") {
    const number = cleanRoomNumber(r.number);
    const floor = typeof r.floor === "number" ? Math.trunc(r.floor) : 1;
    if (!validRoomNumber(number)) return NextResponse.json({ error: "Write a room number like 204 (letters, numbers, dash)." }, { status: 400 });
    const result = await addSingleRoom(number, floor);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    await appendHistory({ actorName: g.user?.name ?? "Owner", actorRole: g.user?.roleLabel ?? "Owner", room: result.room.number, taskId: null, taskTitle: null, taskType: null, action: "Rooms changed", details: `Room ${result.room.number} added on floor ${result.room.floor}.` });
    return NextResponse.json({ room: result.room }, { status: 201 });
  }
  // Bulk by floor + range
  const floor = typeof r.floor === "number" ? Math.trunc(r.floor) : NaN;
  const from = typeof r.from === "number" ? Math.trunc(r.from) : NaN;
  const to = typeof r.to === "number" ? Math.trunc(r.to) : NaN;
  if (!Number.isFinite(floor) || !Number.isFinite(from) || !Number.isFinite(to) || from > to || to - from > 199) {
    return NextResponse.json({ error: "Pick a floor and a number range, for example floor 1, 101 to 110 (max 200 rooms at once)." }, { status: 400 });
  }
  const result = await addRoomsBulk(floor, from, to);
  if (result.added.length) await appendHistory({ actorName: g.user?.name ?? "Owner", actorRole: g.user?.roleLabel ?? "Owner", room: null, taskId: null, taskTitle: null, taskType: null, action: "Rooms changed", details: `Rooms ${from}–${to} added on floor ${floor} (${result.added.length} new).` });
  return NextResponse.json({ added: result.added, skipped: result.skipped }, { status: 201 });
}

export async function PUT(request: Request) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const g = await guard(false);
  if (g.error) return g.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  const hasSetting = ["allowLinksWithoutToken", "autoApproveCleaning", "aiPhotoCheckEnabled", "cleanerPhotoRequired"].some((k) => typeof r[k] === "boolean");
  if (hasSetting) {
    if (g.user?.role !== "owner") {
      return NextResponse.json({ error: "Only the Owner can change these settings." }, { status: 403 });
    }
    const before = (await getHotelData()).settings;
    const { saveSettings } = await import("@/lib/hotel-data");
    const settings = await saveSettings({
      ...(typeof r.allowLinksWithoutToken === "boolean" ? { allowLinksWithoutToken: r.allowLinksWithoutToken } : {}),
      ...(typeof r.autoApproveCleaning === "boolean" ? { autoApproveCleaning: r.autoApproveCleaning } : {}),
      ...(typeof r.aiPhotoCheckEnabled === "boolean" ? { aiPhotoCheckEnabled: r.aiPhotoCheckEnabled } : {}),
      ...(typeof r.cleanerPhotoRequired === "boolean" ? { cleanerPhotoRequired: r.cleanerPhotoRequired } : {}),
    });
    // P2: every change of these settings is written to History.
    const changes: string[] = [];
    if (typeof r.aiPhotoCheckEnabled === "boolean" && r.aiPhotoCheckEnabled !== before.aiPhotoCheckEnabled) changes.push(`AI photo check for cleaning turned ${r.aiPhotoCheckEnabled ? "On" : "Off"}`);
    if (typeof r.cleanerPhotoRequired === "boolean" && r.cleanerPhotoRequired !== before.cleanerPhotoRequired) changes.push(`Cleaners must add a photo turned ${r.cleanerPhotoRequired ? "On" : "Off"}`);
    if (typeof r.autoApproveCleaning === "boolean" && r.autoApproveCleaning !== before.autoApproveCleaning) changes.push(`Auto-approve cleaning when the AI is sure turned ${r.autoApproveCleaning ? "On" : "Off"}`);
    for (const change of changes) {
      await appendHistory({ actorName: g.user?.name ?? "Owner", actorRole: g.user?.roleLabel ?? "Owner", room: null, taskId: null, taskTitle: null, taskType: null, action: "Setting changed", details: `${change} by ${g.user?.name ?? "Owner"}.` });
    }
    return NextResponse.json({ settings });
  }
  return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
}
