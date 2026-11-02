import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { bulkUpdateRooms } from "@/lib/hotel-data";
import { foreignOriginResponse } from "@/lib/security";
import { appendHistory } from "@/lib/history";

/** R2 bulk edit: set room type and/or price for several rooms (Owner only). */
export async function POST(request: Request) {
  const foreign = foreignOriginResponse(request); if (foreign) return foreign;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Only the Owner can change rooms." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(r.ids) ? r.ids.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  if (!ids.length) return NextResponse.json({ error: "Pick at least one room first." }, { status: 400 });
  const roomType = typeof r.roomType === "string" && r.roomType.trim() ? r.roomType.trim().slice(0, 40) : undefined;
  const pricePerNight = typeof r.pricePerNight === "number" && r.pricePerNight >= 0 ? r.pricePerNight : undefined;
  if (roomType === undefined && pricePerNight === undefined) return NextResponse.json({ error: "Set a new type or a new price first." }, { status: 400 });
  const changed = await bulkUpdateRooms(ids, { roomType, pricePerNight });
  await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: null, taskId: null, taskTitle: null, taskType: null, action: "Rooms changed", details: `${user.name} updated ${changed} rooms in one go${roomType ? `, type ${roomType}` : ""}${pricePerNight !== undefined ? `, price ${pricePerNight}` : ""}.` });
  return NextResponse.json({ changed });
}
