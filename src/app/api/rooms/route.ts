import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addRoomsBulk, addSingleRoom, cleanRoomNumber, getHotelData, publicRoom, validRoomNumber } from "@/lib/hotel-data";

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
  return NextResponse.json({ added: result.added, skipped: result.skipped }, { status: 201 });
}

export async function PUT(request: Request) {
  const g = await guard(false);
  if (g.error) return g.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  if (typeof r.allowLinksWithoutToken === "boolean" || typeof r.autoApproveCleaning === "boolean") {
    if (typeof r.autoApproveCleaning === "boolean" && g.user?.role !== "owner") {
      return NextResponse.json({ error: "Only the Owner can change the auto-approve setting." }, { status: 403 });
    }
    const { saveSettings } = await import("@/lib/hotel-data");
    const settings = await saveSettings({
      ...(typeof r.allowLinksWithoutToken === "boolean" ? { allowLinksWithoutToken: r.allowLinksWithoutToken } : {}),
      ...(typeof r.autoApproveCleaning === "boolean" ? { autoApproveCleaning: r.autoApproveCleaning } : {}),
    });
    return NextResponse.json({ settings });
  }
  return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
}
