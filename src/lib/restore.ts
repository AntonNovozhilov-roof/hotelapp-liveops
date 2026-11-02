import { createHash, timingSafeEqual } from "crypto";
import { clearStoredTasks, insertSampleTasks, listStoredTasks } from "./store";
import { clearHistory, appendHistory, listHistory } from "./history";
import { clearReports } from "./reports-store";
import { clearHotelData, getHotelData, saveHotelInfo, bulkUpdateRooms } from "./hotel-data";
import { clearBookings, createBooking, insertSampleBookings, listBookings, addDaysStr, todayStr } from "./bookings";
import { clearConversations } from "./conversations";
import { clearEmployees } from "./employees";
import { clearAiUsage } from "./ai-usage";
import { clearAiDailyCounter } from "./security";
import { clearPhotoCheckCache } from "./photo-check";
import { dbQuery, isDbEnabled } from "./db";
import { DEMO_HOTEL_INFO, loadDemoHotel } from "./demo-hotel";
import { buildSampleBookings, buildSampleWeek } from "./sample-week";

/**
 * Admin restore (/admin/restore, ANT-27 follow-up) — the safe way to wipe
 * test data online. The gate is RESTORE_SECRET, checked on the server with
 * a timing-safe compare; a normal sign-in is NOT enough on purpose (the
 * demo owner password is public). Works in file mode and database mode:
 * every clear/seed helper below already speaks both.
 */

export function restoreSecretConfigured(): boolean {
  return Boolean(process.env.RESTORE_SECRET);
}

/** Timing-safe secret check (hash first, so length never leaks). */
export function restoreSecretMatches(code: unknown): boolean {
  const secret = process.env.RESTORE_SECRET;
  if (!secret || typeof code !== "string" || !code) return false;
  const a = createHash("sha256").update(code).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export interface RestoreCounts {
  deleted: { tasks: number; employees: number };
  seeded: { rooms: number; bookings: number; tasks: number; historyEvents: number };
}

/**
 * Delete ALL hotel data, then load a fresh rich demo hotel. Demo accounts
 * (owner/supervisor/aigerim/ruslan/daniyar/madina) are code, not data, and
 * stay exactly as they are. The fresh history's newest event is
 * "Demo restored" (the History page is newest-first, so it starts there),
 * and the restore is written to the server log with its counts.
 */
export async function restoreCleanDemo(): Promise<RestoreCounts> {
  // 1) Wipe everything. Photos go with the tasks (clearStoredTasks deletes
  // every photo file/object, perfect-room photos included, because the
  // rooms they belong to are wiped right after).
  const deletedTasks = await clearStoredTasks();
  await clearHotelData();
  await clearHistory();
  await clearReports();
  await clearConversations();
  await clearBookings();
  const deletedEmployees = await clearEmployees();
  await clearAiUsage();
  await clearAiDailyCounter();
  await clearPhotoCheckCache();
  if (isDbEnabled()) {
    // Rate-limit hits are counters too (incl. this page's own tries).
    await dbQuery("DELETE FROM rate_limit_hits");
  }

  // 2) Fresh demo hotel: rooms 101-110 + 201-210, hotel info, demo tasks.
  await loadDemoHotel("Admin restore");
  const info = {
    ...DEMO_HOTEL_INFO,
    recommendations: [
      ...DEMO_HOTEL_INFO.recommendations,
      { id: "demo-bistro", title: "Harbour Bistro", note: "A small bistro by the harbour, good for dinner." },
      { id: "demo-museum", title: "Old Town Museum", note: "The old town museum, a short walk from the hotel." },
    ],
  };
  await saveHotelInfo(info);

  // Room types and prices: floor 1 mostly Standard, floor 2 Double/Suite.
  const hotel = await getHotelData();
  const byNumber = new Map(hotel.rooms.map((r) => [r.number, r.id]));
  const setGroup = async (numbers: string[], roomType: string, pricePerNight: number) => {
    const ids = numbers.map((n) => byNumber.get(n)).filter((id): id is string => Boolean(id));
    if (ids.length) await bulkUpdateRooms(ids, { roomType, pricePerNight });
  };
  await setGroup(["101", "102", "103", "104", "105", "106", "107", "108"], "Standard", 80);
  await setGroup(["109", "110"], "Double", 110);
  await setGroup(["201", "202", "203", "204", "205", "206", "207", "208"], "Double", 120);
  await setGroup(["209", "210"], "Suite", 210);
  const { seedDemoPerfectPhotos } = await import("./demo-photos");
  await seedDemoPerfectPhotos();

  // 3) A week of tasks in every stage (new / in progress / in review /
  // done) across all four teams, with matching dated history.
  const weekTasks = await buildSampleWeek();
  await insertSampleTasks(weekTasks);

  // 4) Bookings: the sample week's past week, plus clearly upcoming ones.
  const fresh = await getHotelData();
  const sampleBookings = buildSampleBookings(fresh.rooms.map((r) => ({ id: r.id, number: r.number, pricePerNight: r.pricePerNight })));
  if (sampleBookings.length) await insertSampleBookings(sampleBookings);
  const today = todayStr();
  const upcoming: Array<[string, number, number, string]> = [
    ["205", 3, 2, "Direct"], ["206", 4, 3, "Booking.com"], ["210", 7, 2, "Airbnb"],
  ];
  for (const [number, startIn, nights, source] of upcoming) {
    const room = fresh.rooms.find((r) => r.number === number);
    if (!room) continue;
    await createBooking(
      { roomId: room.id, roomNumber: number, checkIn: addDaysStr(today, startIn), checkOut: addDaysStr(today, startIn + nights), guests: 2, pricePerNight: room.pricePerNight, source: source as "Direct", guestName: "Guest", reference: "BK-2071" },
      "Admin restore",
      true,
    );
  }

  // 5) Fresh history starts with "Demo restored" (newest event). Sample-week
  // events can carry later same-day times, so stamp this one just after the
  // latest seeded event to keep it first on the newest-first History page.
  const seededHistory = await listHistory({ range: "all", limit: 5000 });
  const latestSeeded = seededHistory.reduce((max, e) => Math.max(max, new Date(e.at).getTime()), 0);
  await appendHistory({
    actorName: "Admin restore",
    actorRole: "System",
    room: null,
    taskId: null,
    taskTitle: null,
    taskType: null,
    action: "Demo restored",
    details: "All hotel data was deleted and a fresh hotel was loaded.",
    at: new Date(Math.max(Date.now(), latestSeeded + 1000)).toISOString(),
  });

  const [tasks, bookings, history] = await Promise.all([listStoredTasks(), listBookings(), listHistory({ range: "all", limit: 5000 })]);
  const counts: RestoreCounts = {
    deleted: { tasks: deletedTasks, employees: deletedEmployees },
    seeded: { rooms: fresh.rooms.length, bookings: bookings.length, tasks: tasks.length, historyEvents: history.length },
  };
  console.log(`[restore] Demo restored at ${new Date().toISOString()}: deleted ${counts.deleted.tasks} tasks and ${counts.deleted.employees} employees; seeded ${counts.seeded.rooms} rooms, ${counts.seeded.bookings} bookings, ${counts.seeded.tasks} tasks, ${counts.seeded.historyEvents} history events.`);
  return counts;
}
