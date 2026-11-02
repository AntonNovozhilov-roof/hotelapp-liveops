import { randomUUID } from "crypto";
import type { StoredTask } from "./tasks";
import { appendHistory } from "./history";

/**
 * Sample week (M10, owner-only demo): clearly labelled tasks + history over
 * the past 7 days, including a repeat pattern (3 leaks in room 204), a
 * cleaning that failed the AI check twice, sent-back work, a reopened repair
 * and guest questions the assistant could not answer. Every task has
 * sample:true and "(sample)" in the title, so Remove can delete only these.
 */

interface Ev { task: StoredTask; actor: string; role: string; action: string; details: string; at: Date }

export async function buildSampleWeek(now = new Date()): Promise<StoredTask[]> {
  const tasks: StoredTask[] = []; const events: Ev[] = [];
  const at = (daysAgo: number, hour: number, min = 0) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(hour, min, 0, 0); return d; };
  const mk = (created: Date, updated: Date, p: Partial<StoredTask> & Pick<StoredTask, "department" | "type" | "title" | "room" | "status">): StoredTask => {
    const t: StoredTask = { priority: "medium", confidence: 0.95, photos: [], reviewNote: null, aiCheck: null, aiFailCount: 0, flaggedTwice: false, sample: true, id: `sample-${randomUUID()}`, createdAt: created.toISOString(), updatedAt: updated.toISOString(), ...p } as StoredTask;
    tasks.push(t); return t;
  };
  const ev = (task: StoredTask, when: Date, actor: string, role: string, action: string, details: string) => events.push({ task, actor, role, action, details, at: when });
  const lifecycle = (t: StoredTask, created: Date, worker: string, role: string, acceptMin: number, finishMin: number | null) => {
    ev(t, created, "Guest", "Guest", "Task created", `Guest asked via the room page (AI): ${t.title} (sample)`);
    if (finishMin !== null || t.status !== "new") ev(t, new Date(created.getTime() + acceptMin * 60000), worker, role, "Accepted", `Accepted by ${worker}. (sample)`);
    if (t.status === "in_progress" || t.status === "review" || t.status === "done") ev(t, new Date(created.getTime() + (acceptMin + 10) * 60000), worker, role, "Started", `Started by ${worker}. (sample)`);
    if (finishMin !== null) ev(t, new Date(created.getTime() + finishMin * 60000), worker, role, "Done", `Finished by ${worker}. (sample)`);
  };

  // Repeat pattern: 3 leaks in room 204 (2 done, 1 urgent still open today).
  for (const [d, doneFlag] of [[6, true], [3, true], [0, false]] as [number, boolean][]) {
    const c = at(d, 9); const t = mk(c, doneFlag ? at(d, 11) : c, { department: "maintenance", type: "repair", title: "Fix water leak (sample)", room: "204", status: doneFlag ? "done" : "new", priority: "high" });
    lifecycle(t, c, "Ruslan", "Maintenance", 20, doneFlag ? 120 : null);
  }
  // 2 air-conditioning repairs in room 201.
  for (const d of [5, 2]) { const c = at(d, 10); const t = mk(c, at(d, 12), { department: "maintenance", type: "repair", title: "Fix air conditioning (sample)", room: "201", status: "done" }); lifecycle(t, c, "Ruslan", "Maintenance", 30, 110); }
  // One reopened repair (room 202 tap).
  { const c = at(4, 9); const t = mk(c, at(1, 10), { department: "maintenance", type: "repair", title: "Fix tap or sink (sample)", room: "202", status: "in_progress", reviewNote: "Still dripping, please fix again." });
    lifecycle(t, c, "Ruslan", "Maintenance", 25, 100); ev(t, at(1, 10), "Supervisor", "Supervisor", "Reopened", "Reopened by Supervisor: still dripping. (sample)"); }
  // Cleaning: 3 passed + done, 1 failed twice (in review), 1 sent back.
  for (const [d, room] of [[5, "203"], [2, "205"], [1, "202"]] as [number, string][]) {
    const c = at(d, 11); const t = mk(c, at(d, 13), { department: "housekeeping", type: "cleaning", title: `Clean room ${room} (sample)`, room, status: "done", aiCheck: { score: 100, checks: [], issues: [], model: "sample", mode: "MOCK", checkedAt: at(d, 12).toISOString(), verdict: "ready", comparedToReference: true, highConfidence: true } });
    lifecycle(t, c, "Aigerim", "Housekeeping · Cleaner", 15, 90); ev(t, at(d, 12, 30), "Supervisor", "Supervisor", "Approved", "Approved by Supervisor. (sample)"); }
  { const c = at(1, 10); const t = mk(c, at(1, 12), { department: "housekeeping", type: "cleaning", title: "Clean room 205 (sample)", room: "205", status: "review", aiFailCount: 2, flaggedTwice: true, aiCheck: { score: 40, checks: [], issues: ["Not ready"], model: "sample", mode: "MOCK", checkedAt: at(1, 12).toISOString(), verdict: "different", comparedToReference: true, highConfidence: false } });
    lifecycle(t, c, "Aigerim", "Housekeeping · Cleaner", 15, null); ev(t, at(1, 12), "AI", "AI", "Sent to review", "Failed AI check twice — sent to review automatically. (sample)"); }
  { const c = at(2, 10); const t = mk(c, at(2, 12), { department: "housekeeping", type: "cleaning", title: "Clean room 203 (sample)", room: "203", status: "in_progress", reviewNote: "Bathroom needs another clean.", aiCheck: { score: 60, checks: [], issues: ["Not ready"], model: "sample", mode: "MOCK", checkedAt: at(2, 11).toISOString(), verdict: "different", comparedToReference: true, highConfidence: false } });
    lifecycle(t, c, "Aigerim", "Housekeeping · Cleaner", 15, null); ev(t, at(2, 12), "Supervisor", "Supervisor", "Sent back", "Sent back by Supervisor: bathroom needs another clean. (sample)"); }
  // Housekeeping requests (Aigerim workload).
  for (const [d, title] of [[6, "Bring towels (sample)"], [4, "Bring towels (sample)"], [3, "Bring pillow (sample)"], [1, "Bring towels (sample)"], [0, "Bring towels (sample)"]] as [number, string][]) {
    const c = at(d, 8, 30); const doneFlag = d !== 0; const t = mk(c, doneFlag ? at(d, 9, 30) : c, { department: "housekeeping", type: "request", title, room: "204", status: doneFlag ? "done" : "new" });
    lifecycle(t, c, "Aigerim", "Housekeeping · Cleaner", 10, doneFlag ? 45 : null); }
  // Guest questions the assistant could not answer.
  for (const [d, q] of [[4, "how much is parking?"], [2, "is there a swimming pool?"], [0, "can I get a late check-out and what does it cost?"]] as [number, string][]) {
    const c = at(d, 14); const t = mk(c, c, { department: "front_desk", type: "request", title: `Guest question: ${q} (sample)`, room: "203", status: "new", priority: "medium" });
    ev(t, c, "Guest", "Guest", "Task created", `Guest question the assistant could not answer: ${q} (sample)`); }
  // Front desk + room service done work.
  { const c = at(3, 9); const t = mk(c, at(3, 10), { department: "front_desk", type: "request", title: "Book a taxi (sample)", room: "201", status: "done" }); lifecycle(t, c, "Daniyar", "Front desk", 5, 30); }
  for (const d of [5, 1]) { const c = at(d, 19); const t = mk(c, at(d, 20), { department: "room_service", type: "request", title: "Room service order (sample)", room: "202", status: "done" }); lifecycle(t, c, "Madina", "Room service", 12, 40); }

  for (const e of events.sort((a, b) => a.at.getTime() - b.at.getTime())) {
    await appendHistory({ actorName: e.actor, actorRole: e.role, room: e.task.room, taskId: e.task.id, taskTitle: e.task.title, taskType: e.task.type, action: e.action, details: e.details, at: e.at.toISOString() });
  }
  return tasks;
}

import type { Booking } from "./bookings";

/**
 * Sample bookings (R2): clearly sample:true bookings over the past week so
 * reports show occupancy/revenue. Guest names are fake labels only and are
 * never used in reports/AI (aggregates only).
 */
export function buildSampleBookings(rooms: { id: string; number: string; pricePerNight: number }[], now = new Date()): Booking[] {
  if (!rooms.length) return [];
  const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const day = (offset: number) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset); return dstr(d); };
  const picks: Array<[number, number, number, string]> = [
    [0, -6, 3, "Direct"], [1, -5, 4, "Booking.com"], [2, -3, 2, "Airbnb"], [0, -1, 3, "Direct"], [3, 0, 2, "Other"], [1, -2, 1, "Booking.com"],
  ];
  const out: Booking[] = [];
  for (const [idx, startOff, nights, source] of picks) {
    const room = rooms[idx % rooms.length];
    const price = room.pricePerNight > 0 ? room.pricePerNight : 80 + (idx % 3) * 20;
    const checkIn = day(startOff); const checkOut = day(startOff + nights);
    out.push({
      id: `sample-booking-${randomUUID()}`, roomId: room.id, roomNumber: room.number, checkIn, checkOut,
      guests: 2, pricePerNight: price, total: price * nights, source: source as Booking["source"],
      guestName: "Sample guest", reference: "SAMPLE", status: "active", checkoutTaskId: null, checkedOutAt: null,
      sample: true, createdBy: "Sample week", createdAt: now.toISOString(), updatedAt: now.toISOString(),
    });
  }
  // Drop any that overlap for the same room (keep first).
  return out.filter((b, i) => !out.slice(0, i).some((o) => o.roomNumber === b.roomNumber && b.checkIn < o.checkOut && o.checkIn < b.checkOut));
}
