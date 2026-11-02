/** Booking types + date helpers (R2) — safe for browser and server (no fs). */
export const BOOKING_SOURCES = ["Direct", "Booking.com", "Airbnb", "Other"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export interface Booking {
  id: string;
  roomId: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pricePerNight: number;
  total: number;
  source: BookingSource;
  guestName: string;
  reference: string;
  status: "active" | "cancelled";
  checkoutTaskId: string | null;
  checkedOutAt: string | null;
  sample?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function todayStr(now = new Date()): string { return dateStr(now); }
export function addDaysStr(date: string, days: number): string {
  const [y, m, dd] = date.split("-").map(Number);
  return dateStr(new Date(y, (m ?? 1) - 1, (dd ?? 1) + days));
}
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`).getTime();
  const b = new Date(`${checkOut}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}
export type RoomTodayStatus = "Free" | "Occupied" | "Arriving today" | "Leaving today";
export function roomStatusToday(roomNumber: string, bookings: Booking[], today = todayStr()): RoomTodayStatus {
  const active = bookings.filter((b) => b.roomNumber === roomNumber && b.status === "active");
  if (active.some((b) => b.checkIn === today)) return "Arriving today";
  if (active.some((b) => b.checkOut === today)) return "Leaving today";
  if (active.some((b) => b.checkIn < today && today < b.checkOut)) return "Occupied";
  return "Free";
}
