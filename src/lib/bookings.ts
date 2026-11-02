import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createCleaningTask } from "./store";
import { appendHistory } from "./history";
import { BOOKING_SOURCES, addDaysStr, dateStr, nightsBetween, todayStr, type Booking, type BookingSource } from "./booking-types";

export { BOOKING_SOURCES, addDaysStr, dateStr, nightsBetween, todayStr, roomStatusToday } from "./booking-types";
export type { Booking, BookingSource, RoomTodayStatus } from "./booking-types";

/**
 * Bookings (R2 / ANT-60) — THE one place for manual bookings.
 * Stored in .data/bookings.json (like tasks/hotel/employees) so M2
 * (ANT-18) can move only this file to the database.
 * PRIVACY: guestName/reference live only here for staff screens. They are
 * never sent to the AI, never put in reports, and never in history details.
 */
export function validDateStr(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00`).getTime());
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "bookings.json");

let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

function normalize(raw: unknown): Booking[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const b = x as Record<string, unknown>;
    if (typeof b.id !== "string" || typeof b.roomNumber !== "string" || !validDateStr(b.checkIn) || !validDateStr(b.checkOut)) return [];
    const price = typeof b.pricePerNight === "number" && Number.isFinite(b.pricePerNight) ? b.pricePerNight : 0;
    return [{
      id: b.id, roomId: typeof b.roomId === "string" ? b.roomId : "", roomNumber: b.roomNumber,
      checkIn: b.checkIn, checkOut: b.checkOut,
      guests: typeof b.guests === "number" ? Math.max(1, Math.trunc(b.guests)) : 1,
      pricePerNight: price, total: typeof b.total === "number" ? b.total : price * Math.max(0, nightsBetween(b.checkIn, b.checkOut)),
      source: (BOOKING_SOURCES as readonly string[]).includes(b.source as string) ? (b.source as BookingSource) : "Direct",
      guestName: typeof b.guestName === "string" ? b.guestName : "", reference: typeof b.reference === "string" ? b.reference : "",
      status: b.status === "cancelled" ? "cancelled" as const : "active" as const,
      checkoutTaskId: typeof b.checkoutTaskId === "string" ? b.checkoutTaskId : null,
      checkedOutAt: typeof b.checkedOutAt === "string" ? b.checkedOutAt : null,
      sample: b.sample === true, createdBy: typeof b.createdBy === "string" ? b.createdBy : "",
      createdAt: typeof b.createdAt === "string" ? b.createdAt : new Date().toISOString(),
      updatedAt: typeof b.updatedAt === "string" ? b.updatedAt : new Date().toISOString(),
    }];
  });
}

async function readAll(): Promise<Booking[]> {
  try { return normalize(JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as unknown); } catch { return []; }
}
async function writeAll(list: Booking[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(list, null, 2)}\n`, "utf8");
  await fs.rename(tmp, DATA_FILE);
}

export async function listBookings(): Promise<Booking[]> {
  return (await readAll()).sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
}

function overlaps(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

export interface BookingInput { roomId: string; roomNumber: string; checkIn: string; checkOut: string; guests: number; pricePerNight: number; source: BookingSource; guestName: string; reference: string }

function validateInput(input: BookingInput): string | null {
  if (!validDateStr(input.checkIn) || !validDateStr(input.checkOut)) return "Please pick check-in and check-out dates.";
  if (nightsBetween(input.checkIn, input.checkOut) < 1) return "Check-out must be after check-in (at least 1 night).";
  if (!(input.guests >= 1 && input.guests <= 20)) return "Number of guests must be between 1 and 20.";
  if (!(input.pricePerNight >= 0 && input.pricePerNight <= 1_000_000)) return "Price per night does not look right.";
  return null;
}

export async function createBooking(input: BookingInput, createdBy: string, sample = false): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  const invalid = validateInput(input);
  if (invalid) return { ok: false, error: invalid };
  return withLock(async () => {
    const all = await readAll();
    const clash = all.find((b) => b.status === "active" && b.roomNumber === input.roomNumber && overlaps(input.checkIn, input.checkOut, b.checkIn, b.checkOut));
    if (clash) return { ok: false as const, error: `Room ${input.roomNumber} is already booked for part of those dates (${clash.checkIn} to ${clash.checkOut}). Pick other dates or another room.` };
    const now = new Date().toISOString();
    const booking: Booking = {
      id: randomUUID(), ...input, total: input.pricePerNight * nightsBetween(input.checkIn, input.checkOut),
      status: "active", checkoutTaskId: null, checkedOutAt: null, sample, createdBy, createdAt: now, updatedAt: now,
    };
    all.push(booking);
    await writeAll(all);
    return { ok: true as const, booking };
  });
}

export async function updateBooking(id: string, input: BookingInput): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  const invalid = validateInput(input);
  if (invalid) return { ok: false, error: invalid };
  return withLock(async () => {
    const all = await readAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return { ok: false as const, error: "Booking not found." };
    if (all[idx].status === "cancelled") return { ok: false as const, error: "This booking is cancelled and cannot be edited." };
    const clash = all.find((b) => b.id !== id && b.status === "active" && b.roomNumber === input.roomNumber && overlaps(input.checkIn, input.checkOut, b.checkIn, b.checkOut));
    if (clash) return { ok: false as const, error: `Room ${input.roomNumber} is already booked for part of those dates (${clash.checkIn} to ${clash.checkOut}). Pick other dates or another room.` };
    const updated: Booking = { ...all[idx], ...input, total: input.pricePerNight * nightsBetween(input.checkIn, input.checkOut), updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await writeAll(all);
    return { ok: true as const, booking: updated };
  });
}

export async function cancelBooking(id: string): Promise<Booking | null> {
  return withLock(async () => {
    const all = await readAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    const updated = { ...all[idx], status: "cancelled" as const, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await writeAll(all);
    return updated;
  });
}

export async function insertSampleBookings(bookings: Booking[]): Promise<void> {
  await withLock(async () => { const all = await readAll(); await writeAll([...all, ...bookings]); });
}
export async function deleteSampleBookings(): Promise<number> {
  return withLock(async () => {
    const all = await readAll();
    const kept = all.filter((b) => !b.sample);
    await writeAll(kept);
    return all.length - kept.length;
  });
}
export async function clearBookings(): Promise<void> {
  await withLock(async () => writeAll([]));
}

// ---------- check-out -> cleaning task (exactly once) ----------

/** Claim the checkout task slot. Returns false when a task already exists/claimed. */
async function claimCheckout(id: string): Promise<boolean> {
  return withLock(async () => {
    const all = await readAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1 || all[idx].checkoutTaskId) return false;
    all[idx] = { ...all[idx], checkoutTaskId: `claim:${randomUUID()}`, updatedAt: new Date().toISOString() };
    await writeAll(all);
    return true;
  });
}

async function finalizeCheckout(id: string, taskId: string, manual: boolean): Promise<void> {
  await withLock(async () => {
    const all = await readAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], checkoutTaskId: taskId, checkedOutAt: manual ? new Date().toISOString() : all[idx].checkedOutAt, updatedAt: new Date().toISOString() };
    await writeAll(all);
  });
}

/**
 * Create the "Clean room X" cleaning task for a booking, exactly once.
 * Used by the Checked out button (manual) and by the automatic 11:00 rule.
 */
export async function createCheckoutCleaningTask(bookingId: string, actorName: string, actorRole: string, manual: boolean): Promise<{ created: boolean; booking: Booking | null }> {
  const booking = (await readAll()).find((b) => b.id === bookingId) ?? null;
  if (!booking || booking.status !== "active") return { created: false, booking };
  if (booking.checkoutTaskId && !booking.checkoutTaskId.startsWith("claim:")) return { created: false, booking };
  if (!(await claimCheckout(bookingId))) {
    const fresh = (await readAll()).find((b) => b.id === bookingId) ?? null;
    return { created: false, booking: fresh };
  }
  const task = await createCleaningTask(booking.roomNumber);
  await finalizeCheckout(bookingId, task.id, manual);
  await appendHistory({
    actorName, actorRole, room: booking.roomNumber, taskId: task.id, taskTitle: task.title, taskType: task.type,
    action: "Task created",
    details: manual ? `${actorName} pressed Checked out for room ${booking.roomNumber} — cleaning task created.` : `Guest checked out of room ${booking.roomNumber} (automatic after 11:00) — cleaning task created.`,
  });
  const fresh = (await readAll()).find((b) => b.id === bookingId) ?? null;
  return { created: true, booking: fresh };
}

/**
 * Automatic rule (R2): on the check-out day after 11:00 hotel time, the
 * first staff/supervisor/owner page load creates the cleaning task.
 * Bookings whose check-out day already passed are caught up too. Never twice.
 */
export async function ensureAutoCheckoutTasks(now = new Date()): Promise<number> {
  if (now.getHours() < 11) {
    // Still create for past check-out days (missed days) — the day rule is met.
    const pastDue = (await readAll()).filter((b) => b.status === "active" && !b.checkoutTaskId && b.checkOut < todayStr(now));
    let n = 0;
    for (const b of pastDue) { const r = await createCheckoutCleaningTask(b.id, "Readybell (automatic)", "System", false); if (r.created) n += 1; }
    return n;
  }
  const today = todayStr(now);
  const due = (await readAll()).filter((b) => b.status === "active" && !b.checkoutTaskId && b.checkOut <= today);
  let n = 0;
  for (const b of due) { const r = await createCheckoutCleaningTask(b.id, "Readybell (automatic)", "System", false); if (r.created) n += 1; }
  return n;
}
