import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { countSampleTasks, deleteSampleTasks, insertSampleTasks } from "@/lib/store";
import { buildSampleBookings, buildSampleWeek } from "@/lib/sample-week";
import { deleteSampleBookings, insertSampleBookings } from "@/lib/bookings";
import { getHotelData } from "@/lib/hotel-data";
import { deleteHistoryForTasks } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";

/** Sample week (M10): Owner only. Load creates labelled sample data; remove deletes ONLY sample data. */
export async function POST(request: Request) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Only the Owner can load or remove sample data." }, { status: 403 });
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (body.action === "remove") {
    const removed = await deleteSampleTasks();
    await deleteHistoryForTasks(removed.map((t) => t.id));
    const removedBookings = await deleteSampleBookings();
    return NextResponse.json({ ok: true, removed: removed.length, removedBookings });
  }
  if (body.action === "load") {
    if ((await countSampleTasks()) > 0) return NextResponse.json({ error: "Sample data is already loaded. Remove it first if you want a fresh week." }, { status: 409 });
    const tasks = await buildSampleWeek();
    await insertSampleTasks(tasks);
    const hotel = await getHotelData();
    const sampleBookings = buildSampleBookings(hotel.rooms.map((r) => ({ id: r.id, number: r.number, pricePerNight: r.pricePerNight })));
    if (sampleBookings.length) await insertSampleBookings(sampleBookings);
    return NextResponse.json({ ok: true, created: tasks.length, createdBookings: sampleBookings.length });
  }
  return NextResponse.json({ error: "Use action load or remove." }, { status: 400 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.role !== "owner" && user.role !== "supervisor") return NextResponse.json({ error: "Only the Owner or Supervisor can see reports." }, { status: 403 });
  return NextResponse.json({ sampleCount: await countSampleTasks() });
}
