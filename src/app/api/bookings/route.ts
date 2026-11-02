import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { BOOKING_SOURCES, createBooking, listBookings, type BookingInput, type BookingSource } from "@/lib/bookings";
import { getHotelData } from "@/lib/hotel-data";
import { foreignOriginResponse } from "@/lib/security";
import { appendHistory } from "@/lib/history";

async function guard(write = false) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in to do this." }, { status: 401 }) };
  if (user.role !== "owner" && user.role !== "supervisor") return { error: NextResponse.json({ error: "Only the Owner or Supervisor can see bookings." }, { status: 403 }) };
  void write;
  return { user };
}

export async function GET() {
  const g = await guard(); if ("error" in g) return g.error;
  const [bookings, hotel] = await Promise.all([listBookings(), getHotelData()]);
  return NextResponse.json({ bookings, currency: hotel.settings.currency, rooms: hotel.rooms.map((r) => ({ id: r.id, number: r.number, floor: r.floor, roomType: r.roomType, pricePerNight: r.pricePerNight })) });
}

function parseInput(r: Record<string, unknown>, rooms: { id: string; number: string }[]): BookingInput | { error: string } {
  const roomId = typeof r.roomId === "string" ? r.roomId : "";
  const room = rooms.find((x) => x.id === roomId);
  if (!room) return { error: "Please pick a room." };
  const source = (BOOKING_SOURCES as readonly string[]).includes(r.source as string) ? (r.source as BookingSource) : "Direct";
  return {
    roomId: room.id, roomNumber: room.number,
    checkIn: typeof r.checkIn === "string" ? r.checkIn : "", checkOut: typeof r.checkOut === "string" ? r.checkOut : "",
    guests: typeof r.guests === "number" ? Math.trunc(r.guests) : 1,
    pricePerNight: typeof r.pricePerNight === "number" ? r.pricePerNight : 0,
    source,
    guestName: typeof r.guestName === "string" ? r.guestName.trim().slice(0, 80) : "",
    reference: typeof r.reference === "string" ? r.reference.trim().slice(0, 80) : "",
  };
}

export async function POST(request: Request) {
  const foreign = foreignOriginResponse(request); if (foreign) return foreign;
  const g = await guard(true); if ("error" in g) return g.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const hotel = await getHotelData();
  const input = parseInput((body ?? {}) as Record<string, unknown>, hotel.rooms);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const result = await createBooking(input, g.user!.name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  // History without guest name/reference (privacy).
  await appendHistory({ actorName: g.user!.name, actorRole: g.user!.roleLabel, room: result.booking.roomNumber, taskId: null, taskTitle: null, taskType: null, action: "Booking created", details: `${g.user!.name} booked room ${result.booking.roomNumber} ${result.booking.checkIn} to ${result.booking.checkOut} (${result.booking.source}).` });
  return NextResponse.json({ booking: result.booking }, { status: 201 });
}
