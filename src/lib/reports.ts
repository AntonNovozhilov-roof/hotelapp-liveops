import { DEPARTMENT_LABELS, STAFF, type StoredTask } from "./tasks";
import type { HistoryEvent } from "./history";
import type { Room } from "./hotel-data";
import type { Booking } from "./bookings";

/**
 * AI reports (M10 / ANT-26 + S6 / ANT-34).
 * Facts are calculated HERE from tasks/history/rooms — the AI may only
 * restate these numbers. Every number in AI text is checked against the
 * facts (verifyReportText); a mismatch retries once, then a plain report
 * built straight from the facts is used. No guest personal data is used:
 * only task titles, rooms, team and staff first names.
 */

export type ReportKind = "daily" | "weekly";
export type ReportSource = "ai" | "mock" | "fallback";

export interface ReportPoint { section: string; text: string; taskIds: string[] }

export interface TeamFact {
  department: string; label: string; created: number; done: number; open: number; urgentOpen: number;
  avgAcceptMin: number | null; avgFinishMin: number | null; taskIds: string[];
}
export interface PatternFact { room: string; problem: string; count: number; taskIds: string[] }
export interface WorkloadFact { name: string; department: string; done: number; open: number; taskIds: string[] }

export interface BookingDayFact { date: string; label: string; occupancyPct: number; revenue: number; arrivals: number; departures: number; occupiedNights: number }
export interface BookingTypeFact { roomType: string; revenue: number; nights: number }

export interface ReportFacts {
  // R2 booking facts (aggregates only — never guest names/references)
  occupancyPct: number; roomRevenue: number; avgNightPrice: number; arrivals: number; departures: number;
  occupiedNights: number; availableNights: number; currency: string;
  perDay: BookingDayFact[]; bestDay: BookingDayFact | null; worstDay: BookingDayFact | null; revenueByType: BookingTypeFact[];
  kind: ReportKind;
  periodStart: string; periodEnd: string; periodLabel: string;
  created: number; done: number; open: number; urgentOpen: number; inReview: number;
  waitingLong: number; waitingLongIds: string[];
  sentBack: number; reopenedRepairs: number;
  cleaningPassed: number; cleaningFailed: number; cleaningUnsure: number; cleaningFailedTwice: number;
  roomsWithoutPerfect: string[];
  unanswered: { question: string; taskId: string; room: string }[];
  perTeam: TeamFact[];
  patterns: PatternFact[];
  workload: WorkloadFact[];
  includesSample: boolean; sampleCount: number;
  taskIds: string[];
  allowedNumbers: number[];
}

const OPEN = new Set(["new", "accepted", "in_progress", "review"]);
const WAIT_MS = 2 * 60 * 60 * 1000;

export function periodFor(kind: ReportKind, now = new Date()): { start: Date; end: Date; label: string } {
  const end = now;
  if (kind === "daily") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return { start, end, label: "Yesterday and today so far" };
  }
  return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end, label: "Last 7 days" };
}

const PROBLEM_KEYS: [RegExp, string][] = [
  [/leak|dripping|pipe/i, "leak"], [/toilet/i, "toilet"], [/air.?cond|\bac\b/i, "air conditioning"],
  [/shower/i, "shower"], [/tap|sink/i, "tap or sink"], [/towel/i, "towels"], [/pillow/i, "pillow"],
  [/clean/i, "cleaning"], [/breakfast|food|order/i, "room service order"], [/taxi/i, "taxi"],
];
export function problemKey(title: string): string {
  for (const [re, label] of PROBLEM_KEYS) if (re.test(title)) return label;
  return title.toLowerCase().replace(/\(sample\)/g, "").replace(/guest question:/g, "").trim().split(/\s+/).slice(0, 3).join(" ");
}

function avg(nums: number[]): number | null { return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null; }

export function computeReportFacts(kind: ReportKind, tasks: StoredTask[], history: HistoryEvent[], rooms: Room[], now = new Date(), bookings: Booking[] = [], currency = "USD"): ReportFacts {
  const { start, end, label } = periodFor(kind, now);
  const inPeriod = (iso: string) => { const t = new Date(iso).getTime(); return t >= start.getTime() && t <= end.getTime(); };
  const periodTasks = tasks.filter((t) => inPeriod(t.createdAt));
  const openTasks = tasks.filter((t) => OPEN.has(t.status));
  const periodIds = new Set([...periodTasks.map((t) => t.id), ...openTasks.map((t) => t.id)]);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const histPeriod = history.filter((e) => inPeriod(e.at));

  const doneEvents = histPeriod.filter((e) => e.action === "Done" && e.taskId);
  const doneIds = new Set(doneEvents.map((e) => e.taskId as string));
  // Tasks done in period: a Done history event, or (old tasks) status done + updated in period.
  const doneTasks = tasks.filter((t) => doneIds.has(t.id) || (t.status === "done" && inPeriod(t.updatedAt)));
  const doneIdSet = new Set(doneTasks.map((t) => t.id));

  const urgentOpenTasks = openTasks.filter((t) => t.priority === "high");
  const waiting = openTasks.filter((t) => now.getTime() - new Date(t.createdAt).getTime() > WAIT_MS && t.status !== "review")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const sentBackIds = new Set(histPeriod.filter((e) => e.action === "Sent back" && e.taskId).map((e) => e.taskId as string));
  const reopenedIds = new Set(histPeriod.filter((e) => e.action === "Reopened" && e.taskId && (byId.get(e.taskId)?.type === "repair" || e.taskType === "repair")).map((e) => e.taskId as string));

  const cleaningChecked = tasks.filter((t) => t.type === "cleaning" && t.aiCheck && (inPeriod(t.aiCheck.checkedAt) || inPeriod(t.createdAt)));
  const perTeam: TeamFact[] = Object.entries(DEPARTMENT_LABELS).map(([dept, lbl]) => {
    const teamPeriod = periodTasks.filter((t) => t.department === dept);
    const teamDone = doneTasks.filter((t) => t.department === dept);
    const teamOpen = openTasks.filter((t) => t.department === dept);
    const accept: number[] = []; const finish: number[] = [];
    for (const t of teamPeriod) {
      const evs = history.filter((e) => e.taskId === t.id).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      const created = evs.find((e) => e.action === "Task created"); const acc = evs.find((e) => e.action === "Accepted");
      const doneEv = [...evs].reverse().find((e) => e.action === "Done");
      const base = created ? new Date(created.at).getTime() : new Date(t.createdAt).getTime();
      if (acc) accept.push((new Date(acc.at).getTime() - base) / 60000);
      if (doneEv) finish.push((new Date(doneEv.at).getTime() - base) / 60000);
    }
    return { department: dept, label: lbl, created: teamPeriod.length, done: teamDone.length, open: teamOpen.length, urgentOpen: teamOpen.filter((t) => t.priority === "high").length, avgAcceptMin: avg(accept), avgFinishMin: avg(finish), taskIds: [...teamPeriod.map((t) => t.id), ...teamOpen.map((t) => t.id)].filter((v, i, a) => a.indexOf(v) === i) };
  });

  const groups = new Map<string, PatternFact>();
  for (const t of periodTasks.filter((x) => x.type === "repair" || x.type === "cleaning")) {
    const key = `${t.room}|${problemKey(t.title)}`;
    const g = groups.get(key) ?? { room: t.room, problem: problemKey(t.title), count: 0, taskIds: [] };
    g.count += 1; g.taskIds.push(t.id); groups.set(key, g);
  }
  const patterns = [...groups.values()].filter((g) => g.count >= 2).sort((a, b) => b.count - a.count).slice(0, 5);

  const workload: WorkloadFact[] = STAFF.map((s) => {
    const doneBy = new Set(doneEvents.filter((e) => e.actorName === s.name).map((e) => e.taskId as string));
    const openTeam = openTasks.filter((t) => t.department === s.department);
    return { name: s.name, department: s.department, done: doneBy.size, open: openTeam.length, taskIds: [...doneBy, ...openTeam.map((t) => t.id)] };
  });
  // E1: real employees appear by their real name too.
  for (const e of doneEvents) {
    if (!e.actorName || ["Guest", "AI"].includes(e.actorName) || workload.some((w) => w.name === e.actorName)) continue;
    const doneBy = new Set(doneEvents.filter((x) => x.actorName === e.actorName).map((x) => x.taskId as string));
    workload.push({ name: e.actorName, department: "", done: doneBy.size, open: 0, taskIds: [...doneBy] });
  }

  const unanswered = periodTasks.filter((t) => t.department === "front_desk" && /guest question/i.test(t.title))
    .map((t) => ({ question: t.title.replace(/^.*guest question:\s*/i, "").slice(0, 120), taskId: t.id, room: t.room }));
  const roomsWithoutPerfect = rooms.filter((r) => !r.reference).map((r) => r.number);
  const includesSample = tasks.some((t) => t.sample && periodIds.has(t.id));

  // ---- R2 booking facts (aggregates only) ----
  const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dayCount = kind === "daily" ? 2 : 7;
  const dates: string[] = [];
  for (let i = dayCount - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); dates.push(dstr(d)); }
  const dateSet = new Set(dates);
  const activeBookings = bookings.filter((b) => b.status === "active");
  const roomTypeByNumber = new Map(rooms.map((r) => [r.number, r.roomType || "Standard"]));
  const MONTHS_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let occupiedNights = 0; let roomRevenue = 0;
  const byTypeMap = new Map<string, BookingTypeFact>();
  const perDay: BookingDayFact[] = dates.map((date) => {
    let occ = 0; let rev = 0;
    for (const b of activeBookings) {
      if (b.checkIn <= date && date < b.checkOut) {
        occ += 1; rev += b.pricePerNight;
        const type = roomTypeByNumber.get(b.roomNumber) ?? "Standard";
        const row = byTypeMap.get(type) ?? { roomType: type, revenue: 0, nights: 0 };
        // per-type totals are accumulated once below, not per day loop duplication guard: handled after
        void row;
      }
    }
    occupiedNights += occ; roomRevenue += rev;
    const d = new Date(`${date}T12:00:00`);
    return { date, label: `${d.getDate()} ${MONTHS_S[d.getMonth()]}`, occupancyPct: rooms.length ? Math.round((occ / rooms.length) * 100) : 0, revenue: rev, arrivals: activeBookings.filter((b) => b.checkIn === date).length, departures: activeBookings.filter((b) => b.checkOut === date).length, occupiedNights: occ };
  });
  // revenue by type over the whole period (count each occupied night once)
  for (const b of activeBookings) {
    for (const date of dates) {
      if (b.checkIn <= date && date < b.checkOut) {
        const type = roomTypeByNumber.get(b.roomNumber) ?? "Standard";
        const row = byTypeMap.get(type) ?? { roomType: type, revenue: 0, nights: 0 };
        row.revenue += b.pricePerNight; row.nights += 1; byTypeMap.set(type, row);
      }
    }
  }
  const revenueByType = [...byTypeMap.values()].sort((a, b) => b.revenue - a.revenue);
  const availableNights = rooms.length * dates.length;
  const occupancyPct = availableNights ? Math.round((occupiedNights / availableNights) * 100) : 0;
  const avgNightPrice = occupiedNights ? Math.round((roomRevenue / occupiedNights) * 100) / 100 : 0;
  const arrivals = activeBookings.filter((b) => dateSet.has(b.checkIn)).length;
  const departures = activeBookings.filter((b) => dateSet.has(b.checkOut)).length;
  const sortedDays = [...perDay].sort((a, b) => b.revenue - a.revenue || b.occupancyPct - a.occupancyPct);
  const bestDay = perDay.length ? sortedDays[0] : null;
  const worstDay = perDay.length ? sortedDays[sortedDays.length - 1] : null;

  const facts: ReportFacts = {
    occupancyPct, roomRevenue: Math.round(roomRevenue * 100) / 100, avgNightPrice, arrivals, departures,
    occupiedNights, availableNights, currency, perDay, bestDay, worstDay, revenueByType,
    kind, periodStart: start.toISOString(), periodEnd: end.toISOString(), periodLabel: label,
    created: periodTasks.length, done: doneTasks.length, open: openTasks.length,
    urgentOpen: urgentOpenTasks.length, inReview: openTasks.filter((t) => t.status === "review").length,
    waitingLong: waiting.length, waitingLongIds: waiting.map((t) => t.id),
    sentBack: sentBackIds.size, reopenedRepairs: reopenedIds.size,
    cleaningPassed: cleaningChecked.filter((t) => t.aiCheck?.verdict === "ready").length,
    cleaningFailed: cleaningChecked.filter((t) => t.aiCheck?.verdict === "different").length,
    cleaningUnsure: cleaningChecked.filter((t) => t.aiCheck?.verdict === "unsure" || !t.aiCheck?.verdict).length,
    cleaningFailedTwice: tasks.filter((t) => t.flaggedTwice && periodIds.has(t.id)).length,
    roomsWithoutPerfect, unanswered, perTeam, patterns, workload,
    includesSample, sampleCount: tasks.filter((t) => t.sample).length,
    taskIds: [...periodIds], allowedNumbers: [],
  };
  facts.allowedNumbers = collectAllowedNumbers(facts, tasks, rooms);
  return facts;
}

function collectAllowedNumbers(f: ReportFacts, tasks: StoredTask[], rooms: Room[]): number[] {
  // R2 booking numbers are added after facts creation via collectBookingNumbers below.
  void f; void tasks; void rooms;
  return collectAllowedNumbersInner(f, tasks, rooms);
}
function collectBookingNumbersInto(s: Set<number>, f: ReportFacts) {
  const add = (n: number | null | undefined) => { if (n === null || n === undefined || Number.isNaN(n)) return; s.add(n); s.add(Math.round(n)); s.add(Math.round(n * 10) / 10); s.add(Math.round(n * 100) / 100); };
  [f.occupancyPct, f.roomRevenue, f.avgNightPrice, f.arrivals, f.departures, f.occupiedNights, f.availableNights].forEach(add);
  for (const d of f.perDay) { [d.occupancyPct, d.revenue, d.arrivals, d.departures, d.occupiedNights].forEach(add); const dayNum = Number(d.date.slice(8, 10)); add(dayNum); }
  for (const r of f.revenueByType) { add(r.revenue); add(r.nights); }
}
function collectAllowedNumbersInner(f: ReportFacts, tasks: StoredTask[], rooms: Room[]): number[] {
  const s = new Set<number>();
  const add = (n: number | null | undefined) => { if (n === null || n === undefined || Number.isNaN(n)) return; s.add(n); s.add(Math.round(n)); s.add(Math.round(n * 10) / 10); };
  [f.created, f.done, f.open, f.urgentOpen, f.inReview, f.waitingLong, f.sentBack, f.reopenedRepairs, f.cleaningPassed, f.cleaningFailed, f.cleaningUnsure, f.cleaningFailedTwice, f.roomsWithoutPerfect.length, f.unanswered.length, f.sampleCount, f.patterns.length, f.perTeam.length].forEach(add);
  if (f.created > 0) { add(Math.round((f.done / f.created) * 100)); add(Math.round((f.open / Math.max(1, f.created + f.open)) * 100)); }
  for (const t of f.perTeam) { [t.created, t.done, t.open, t.urgentOpen].forEach(add); add(t.avgAcceptMin); add(t.avgFinishMin); if (t.created) add(Math.round((t.done / t.created) * 100)); }
  for (const p of f.patterns) add(p.count);
  for (const w of f.workload) { add(w.done); add(w.open); add(w.done + w.open); }
  add(f.workload.reduce((a, w) => a + w.done, 0)); add(f.workload.reduce((a, w) => a + w.open, 0));
  for (const t of tasks) { const n = parseInt(t.room, 10); if (!Number.isNaN(n)) s.add(n); }
  for (const r of rooms) { const n = parseInt(r.number, 10); if (!Number.isNaN(n)) s.add(n); }
  [0, 1, 2, 3, 7, 24, 120].forEach(add); // period days, suggestion count, waiting threshold (2h = 120 min)
  collectBookingNumbersInto(s, f);
  return [...s];
}

/** Every number in the text must be one of the fact numbers. */
export function verifyReportText(texts: string[], facts: ReportFacts): { ok: boolean; bad: number[] } {
  const bad: number[] = [];
  for (const text of texts) {
    for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
      const n = parseFloat(m[0].replace(",", "."));
      const ok = facts.allowedNumbers.some((a) => Math.abs(a - n) < 0.051 || Math.abs(Math.round(a) - n) < 0.051);
      if (!ok && !bad.includes(n)) bad.push(n);
    }
  }
  return { ok: bad.length === 0, bad };
}

function topPatternText(f: ReportFacts): string {
  const p = f.patterns[0];
  return p ? `Room ${p.room} had ${p.count} ${p.problem} tasks — the same problem keeps coming back there.` : "No room had the same problem again and again in this period.";
}

/** Plain report built straight from the facts — always number-safe. */
function moneyPlain(amount: number, currency: string): string {
  const r = Math.round(amount * 100) / 100;
  return `${currency} ${Number.isInteger(r) ? String(r) : r.toFixed(2)}`;
}
function bookingPoint(f: ReportFacts): ReportPoint {
  if (f.kind === "daily") {
    return { section: "Rooms and bookings", text: `Occupancy ${f.occupancyPct}% (${f.occupiedNights} of ${f.availableNights} room nights), room revenue ${moneyPlain(f.roomRevenue, f.currency)}, average ${moneyPlain(f.avgNightPrice, f.currency)} per occupied night, ${f.arrivals} arrivals and ${f.departures} departures.`, taskIds: [] };
  }
  const trend = f.perDay.map((d) => `${d.label}: ${d.occupancyPct}% (${moneyPlain(d.revenue, f.currency)})`).join(", ");
  const byType = f.revenueByType.length ? f.revenueByType.map((r) => `${r.roomType} ${moneyPlain(r.revenue, f.currency)} (${r.nights} nights)`).join(", ") : "no occupied nights";
  return { section: "Rooms and bookings", text: `Occupancy ${f.occupancyPct}%, room revenue ${moneyPlain(f.roomRevenue, f.currency)}, average ${moneyPlain(f.avgNightPrice, f.currency)} per occupied night, ${f.arrivals} arrivals and ${f.departures} departures. Per day: ${trend}. Best day: ${f.bestDay ? `${f.bestDay.label} at ${f.bestDay.occupancyPct}% (${moneyPlain(f.bestDay.revenue, f.currency)})` : "none"}. Worst day: ${f.worstDay ? `${f.worstDay.label} at ${f.worstDay.occupancyPct}% (${moneyPlain(f.worstDay.revenue, f.currency)})` : "none"}. Revenue by room type: ${byType}.`, taskIds: [] };
}

export function buildPlainReport(f: ReportFacts): ReportPoint[] {
  const teamLine = f.perTeam.filter((t) => t.created || t.open).map((t) => `${t.label}: ${t.created} new, ${t.done} done, ${t.open} open`).join(". ");
  const allOpenIds = f.perTeam.flatMap((t) => t.taskIds);
  if (f.kind === "daily") {
    const urgentIds = f.perTeam.flatMap((t) => t.taskIds);
    return [
      { section: "What needs attention today", text: f.urgentOpen || f.waitingLong ? `${f.urgentOpen} urgent tasks are still open and ${f.waitingLong} tasks have been waiting more than 2 hours. Start with those.` : "No urgent tasks are open and nothing has been waiting too long. A calm start to the day.", taskIds: [...new Set([...f.waitingLongIds, ...urgentIds])].slice(0, 10) },
      { section: "Key numbers", text: `${f.created} tasks came in, ${f.done} are done and ${f.open} are still open (${f.inReview} in review). ${teamLine}.`, taskIds: allOpenIds.slice(0, 10) },
      bookingPoint(f),
      { section: "Cleaning and repairs", text: `Cleaning AI checks: ${f.cleaningPassed} passed, ${f.cleaningFailed} did not pass, ${f.cleaningFailedTwice} failed twice and went to a supervisor. ${f.sentBack} tasks were sent back and ${f.reopenedRepairs} repairs were reopened.`, taskIds: [] },
      f.unanswered.length
        ? { section: "Guest questions", text: `The assistant could not answer ${f.unanswered.length} guest questions (${f.unanswered.map((u) => `"${u.question}"`).join(", ")}). Add the answers to the hotel info sheet so it can answer next time.`, taskIds: f.unanswered.map((u) => u.taskId) }
        : { section: "Guest questions", text: "The assistant could answer every guest question in this period — nothing new to add to the hotel info sheet.", taskIds: [] },
    ];
  }
  const busiest = [...f.workload].sort((a, b) => b.done - a.done)[0];
  const suggestions: ReportPoint[] = [
    f.patterns[0]
      ? { section: "Suggestions", text: `Suggestion 1: Book a proper fix for the ${f.patterns[0].problem} in room ${f.patterns[0].room} — it came back ${f.patterns[0].count} times, so a lasting repair should stop the repeat visits.`, taskIds: f.patterns[0].taskIds }
      : { section: "Suggestions", text: "Suggestion 1: Keep the daily check on waiting tasks — no repeat problem stood out this week.", taskIds: [] },
    f.unanswered.length
      ? { section: "Suggestions", text: `Suggestion 2: Add answers for the ${f.unanswered.length} unanswered guest questions to the hotel info sheet, so the assistant can answer them itself next time.`, taskIds: f.unanswered.map((u) => u.taskId) }
      : { section: "Suggestions", text: "Suggestion 2: Add one more common guest question and answer to the hotel info sheet, so the assistant can help even faster.", taskIds: [] },
    f.roomsWithoutPerfect.length
      ? { section: "Suggestions", text: `Suggestion 3: Add a perfect room photo for the ${f.roomsWithoutPerfect.length} rooms that do not have one yet, so cleaning checks can compare against it.`, taskIds: [] }
      : { section: "Suggestions", text: `Suggestion 3: ${busiest ? `${busiest.name} finished the most work (${busiest.done} tasks done)` : "The team shared the work well"} — thank the busiest person and spread urgent tasks out next week.`, taskIds: busiest?.taskIds ?? [] },
  ];
  return [
    { section: "What went well", text: `${f.done} tasks were finished. Cleaning AI checks passed ${f.cleaningPassed} times. ${teamLine}.`, taskIds: allOpenIds.slice(0, 10) },
    { section: "What went wrong", text: `${f.open} tasks are still open, ${f.urgentOpen} of them urgent, and ${f.waitingLong} waited more than 2 hours. ${f.sentBack} tasks were sent back, ${f.cleaningFailedTwice} cleanings failed the AI check twice, and ${f.reopenedRepairs} repairs were reopened.`, taskIds: f.waitingLongIds.slice(0, 10) },
    { section: "Patterns", text: topPatternText(f), taskIds: f.patterns[0]?.taskIds ?? [] },
    { section: "Staff workload", text: f.workload.map((w) => `${w.name}: ${w.done} done, ${w.open} open`).join(". ") + ".", taskIds: [] },
    bookingPoint(f),
    ...suggestions,
  ];
}

export function factsForPrompt(f: ReportFacts): string {
  return JSON.stringify({
    period: f.periodLabel, created: f.created, done: f.done, open: f.open, urgentOpen: f.urgentOpen, inReview: f.inReview,
    waitingMoreThan2Hours: f.waitingLong, sentBack: f.sentBack, reopenedRepairs: f.reopenedRepairs,
    cleaningAiPassed: f.cleaningPassed, cleaningAiFailed: f.cleaningFailed, cleaningAiUnsure: f.cleaningUnsure, cleaningFailedTwice: f.cleaningFailedTwice,
    roomsWithoutPerfectPhoto: f.roomsWithoutPerfect, roomsWithoutPerfectCount: f.roomsWithoutPerfect.length,
    perTeam: f.perTeam.map((t) => ({ team: t.label, created: t.created, done: t.done, open: t.open, urgentOpen: t.urgentOpen, avgMinutesToAccept: t.avgAcceptMin, avgMinutesToFinish: t.avgFinishMin, taskIds: t.taskIds })),
    repeatPatterns: f.patterns, workload: f.workload, unansweredGuestQuestions: f.unanswered,
    waitingLongTaskIds: f.waitingLongIds, allowedNumbers: f.allowedNumbers,
    bookings: { currency: f.currency, occupancyPct: f.occupancyPct, roomRevenue: f.roomRevenue, avgNightPrice: f.avgNightPrice, arrivals: f.arrivals, departures: f.departures, occupiedNights: f.occupiedNights, availableNights: f.availableNights, perDay: f.perDay, bestDay: f.bestDay, worstDay: f.worstDay, revenueByType: f.revenueByType },
  }, null, 1);
}
