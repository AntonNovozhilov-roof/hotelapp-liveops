import { DEPARTMENT_LABELS, STAFF, type StoredTask } from "./tasks";
import type { HistoryEvent } from "./history";
import type { Room } from "./hotel-data";

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

export interface ReportFacts {
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

export function computeReportFacts(kind: ReportKind, tasks: StoredTask[], history: HistoryEvent[], rooms: Room[], now = new Date()): ReportFacts {
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

  const unanswered = periodTasks.filter((t) => t.department === "front_desk" && /guest question/i.test(t.title))
    .map((t) => ({ question: t.title.replace(/^.*guest question:\s*/i, "").slice(0, 120), taskId: t.id, room: t.room }));
  const roomsWithoutPerfect = rooms.filter((r) => !r.reference).map((r) => r.number);
  const includesSample = tasks.some((t) => t.sample && periodIds.has(t.id));

  const facts: ReportFacts = {
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
export function buildPlainReport(f: ReportFacts): ReportPoint[] {
  const teamLine = f.perTeam.filter((t) => t.created || t.open).map((t) => `${t.label}: ${t.created} new, ${t.done} done, ${t.open} open`).join(". ");
  const allOpenIds = f.perTeam.flatMap((t) => t.taskIds);
  if (f.kind === "daily") {
    const urgentIds = f.perTeam.flatMap((t) => t.taskIds);
    return [
      { section: "What needs attention today", text: f.urgentOpen || f.waitingLong ? `${f.urgentOpen} urgent tasks are still open and ${f.waitingLong} tasks have been waiting more than 2 hours. Start with those.` : "No urgent tasks are open and nothing has been waiting too long. A calm start to the day.", taskIds: [...new Set([...f.waitingLongIds, ...urgentIds])].slice(0, 10) },
      { section: "Key numbers", text: `${f.created} tasks came in, ${f.done} are done and ${f.open} are still open (${f.inReview} in review). ${teamLine}.`, taskIds: allOpenIds.slice(0, 10) },
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
  }, null, 1);
}
