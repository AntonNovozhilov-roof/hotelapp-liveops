import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData, saveHotelInfo, type FaqItem, type HotelInfo } from "@/lib/hotel-data";
import { randomUUID } from "crypto";
import { appendHistory } from "@/lib/history";

export async function GET() {
  const data = await getHotelData();
  return NextResponse.json({ hotelInfo: data.hotelInfo });
}

const FIELDS = ["hotelName", "address", "receptionPhone", "emergencyNumber", "wifiName", "wifiPassword", "checkIn", "checkOut", "breakfastHours", "houseRules"] as const;

export async function PUT(request: Request) {
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
  await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: null, taskId: null, taskTitle: null, taskType: null, action: "Hotel info saved", details: `Hotel info saved by ${user.name}.` });
  return NextResponse.json({ hotelInfo: saved, saved: true });
}
