import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData, getRoomByNumber, guestLinkAllowed, guestSafeHotelInfo, saveHotelInfo, saveSettings, type FaqItem, type HotelInfo } from "@/lib/hotel-data";
import { randomUUID } from "crypto";
import { appendHistory } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";

/**
 * Hotel info reads (SEC1): the Owner gets the full sheet (for editing).
 * Everyone else — guests — only gets guest-safe fields, and only with a
 * valid room link (?room=<number>&t=<QR token>, or DEMO_MODE without token).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const data = await getHotelData();
  if (user?.role === "owner") {
    return NextResponse.json({ hotelInfo: data.hotelInfo, currency: data.settings.currency });
  }
  const sp = new URL(request.url).searchParams;
  const roomNumber = sp.get("room");
  if (!roomNumber) {
    return NextResponse.json(
      { error: user ? "Only the Owner can see the full hotel info." : "Please sign in, or open your room link from the QR code." },
      { status: user ? 403 : 401 },
    );
  }
  const { room } = await getRoomByNumber(roomNumber);
  if (!guestLinkAllowed(room, sp.get("t"), data.settings, data.rooms.length > 0)) {
    return NextResponse.json({ error: "This room link is not valid. Please scan the QR code in your room." }, { status: 403 });
  }
  return NextResponse.json({ hotelInfo: guestSafeHotelInfo(data.hotelInfo) });
}

const FIELDS = ["hotelName", "address", "receptionPhone", "emergencyNumber", "wifiName", "wifiPassword", "checkIn", "checkOut", "breakfastHours", "houseRules"] as const;

export async function PUT(request: Request) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Only the Owner can change the hotel info." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;
  const current = (await getHotelData()).hotelInfo;
  const info: HotelInfo = { ...current };
  for (const f of FIELDS) {
    if (typeof r[f] === "string") info[f] = (r[f] as string).trim().slice(0, f === "houseRules" ? 2000 : 200);
  }
  if (!info.hotelName) return NextResponse.json({ error: "Please write the hotel name." }, { status: 400 });
  if (Array.isArray(r.faqs)) {
    const faqs: FaqItem[] = [];
    for (const x of r.faqs.slice(0, 50)) {
      if (!x || typeof x !== "object") continue;
      const f = x as Record<string, unknown>;
      const q = typeof f.question === "string" ? f.question.trim().slice(0, 300) : "";
      const a = typeof f.answer === "string" ? f.answer.trim().slice(0, 1000) : "";
      if (q && a) faqs.push({ id: typeof f.id === "string" ? f.id : randomUUID(), question: q, answer: a });
    }
    info.faqs = faqs;
  }
  const saved = await saveHotelInfo(info);
  let currency = (await getHotelData()).settings.currency;
  if (typeof r.currency === "string" && /^[A-Za-z]{3}$/.test(r.currency.trim())) {
    currency = (await saveSettings({ currency: r.currency.trim() })).currency;
  }
  await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: null, taskId: null, taskTitle: null, taskType: null, action: "Hotel info saved", details: `Hotel info saved by ${user.name}.` });
  return NextResponse.json({ hotelInfo: saved, currency, saved: true });
}
