import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelBooking, createCheckoutCleaningTask, updateBooking, type BookingInput } from "@/lib/bookings";
import { BOOKING_SOURCES, type BookingSource } from "@/lib/bookings";
import { getHotelData } from "@/lib/hotel-data";
import { foreignOriginResponse } from "@/lib/security";
import { appendHistory } from "@/lib/history";

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in to do this." }, { status: 401 }) };
  if (user.role !== "owner" && user.role !== "supervisor") return { error: NextResponse.json({ error: "Only the Owner or Supervisor can change bookings." }, { status: 403 }) };
  return { user };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreign = foreignOriginResponse(request); if (foreign) return foreign;
  const g = await guard(); if ("error" in g) return g.error;
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const r = (body ?? {}) as Record<string, unknown>;

  if (r.action === "cancel") {
    const booking = await cancelBooking(id);
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    await appendHistory({ actorName: g.user!.name, actorRole: g.user!.roleLabel, room: booking.roomNumber, taskId: null, taskTitle: null, taskType: null, action: "Booking cancelled", details: `${g.user!.name} cancelled the booking for room ${booking.roomNumber} ${booking.checkIn} to ${booking.checkOut}.` });
    return NextResponse.json({ booking });
  }
  if (r.action === "checkout") {
    const result = await createCheckoutCleaningTask(id, g.user!.name, g.user!.roleLabel, true);
    if (!result.booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    return NextResponse.json({ booking: result.booking, cleaningCreated: result.created });
  }
  // Edit
  const hotel = await getHotelData();
  const roomId = typeof r.roomId === "string" ? r.roomId : "";
  const room = hotel.rooms.find((x) => x.id === roomId);
  if (!room) return NextResponse.json({ error: "Please pick a room." }, { status: 400 });
  const input: BookingInput = {
    roomId: room.id, roomNumber: room.number,
    checkIn: typeof r.checkIn === "string" ? r.checkIn : "", checkOut: typeof r.checkOut === "string" ? r.checkOut : "",
    guests: typeof r.guests === "number" ? Math.trunc(r.guests) : 1,
    pricePerNight: typeof r.pricePerNight === "number" ? r.pricePerNight : 0,
    source: (BOOKING_SOURCES as readonly string[]).includes(r.source as string) ? (r.source as BookingSource) : "Direct",
    guestName: typeof r.guestName === "string" ? r.guestName.trim().slice(0, 80) : "",
    reference: typeof r.reference === "string" ? r.reference.trim().slice(0, 80) : "",
  };
  const result = await updateBooking(id, input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "Booking not found." ? 404 : 409 });
  await appendHistory({ actorName: g.user!.name, actorRole: g.user!.roleLabel, room: result.booking.roomNumber, taskId: null, taskTitle: null, taskType: null, action: "Booking changed", details: `${g.user!.name} changed the booking for room ${result.booking.roomNumber} (${result.booking.checkIn} to ${result.booking.checkOut}).` });
  return NextResponse.json({ booking: result.booking });
}
