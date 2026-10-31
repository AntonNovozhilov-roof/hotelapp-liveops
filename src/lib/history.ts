import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { AiCheckItem } from "./tasks";

/**
 * History events (M8 / ANT-24) — one event for every step, stored in
 * .data/history.json like the other local data. Privacy: the guest chat
 * is never stored here, only the task request text (the task title).
 * AI item details are stored for the system only and never shown.
 */
export interface HistoryAiDetails {
  verdict: string | null;
  score: number;
  model: string;
  mode: string;
  checks: AiCheckItem[];
}

export interface HistoryEvent {
  id: string;
  at: string;
  actorName: string;
  actorRole: string;
  room: string | null;
  taskId: string | null;
  taskTitle: string | null;
  taskType: string | null;
  action: string;
  details: string;
  ai: HistoryAiDetails | null;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "history.json");

let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readAll(): Promise<HistoryEvent[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEvent =>
        Boolean(e) &&
        typeof e === "object" &&
        typeof (e as HistoryEvent).id === "string" &&
        typeof (e as HistoryEvent).at === "string" &&
        typeof (e as HistoryEvent).action === "string",
    );
  } catch {
    return [];
  }
}

async function writeAll(events: HistoryEvent[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(events, null, 2)}\n`, "utf8");
  await fs.rename(tmp, DATA_FILE);
}

/** Save one event. Never throws into the caller's flow. `at` is only for sample-week data (M10). */
export async function appendHistory(
  event: Omit<HistoryEvent, "id" | "at" | "ai"> & { ai?: HistoryAiDetails | null; at?: string },
): Promise<void> {
  try {
    await withLock(async () => {
      const all = await readAll();
      all.push({
        ...event,
        ai: event.ai ?? null,
        id: randomUUID(),
        at: event.at ?? new Date().toISOString(),
      });
      await writeAll(all);
    });
  } catch (error) {
    console.error(
      "Could not save history event:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

export interface HistoryFilter {
  taskId?: string;
  room?: string;
  person?: string;
  taskType?: string;
  range?: "today" | "7d" | "all";
  search?: string;
  limit?: number;
}

/** Newest first, with the History page filters (M9). */
export async function listHistory(filter: HistoryFilter = {}): Promise<HistoryEvent[]> {
  const all = await readAll();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const q = filter.search?.trim().toLowerCase();
  return all
    .filter((e) => {
      if (filter.taskId && e.taskId !== filter.taskId) return false;
      if (filter.room && e.room !== filter.room) return false;
      if (filter.person && e.actorName !== filter.person) return false;
      if (filter.taskType && e.taskType !== filter.taskType) return false;
      const at = new Date(e.at).getTime();
      if (filter.range === "today" && at < startOfToday) return false;
      if (filter.range === "7d" && at < weekAgo) return false;
      if (q) {
        const hay = `${e.actorName} ${e.action} ${e.details} ${e.taskTitle ?? ""} ${e.room ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, filter.limit ?? 500);
}

export async function clearHistory(): Promise<void> {
  await withLock(async () => writeAll([]));
}

/** Remove only the events of the given tasks (sample-week cleanup, M10). */
export async function deleteHistoryForTasks(taskIds: string[]): Promise<number> {
  const ids = new Set(taskIds);
  if (!ids.size) return 0;
  return withLock(async () => {
    const all = await readAll();
    const kept = all.filter((e) => !e.taskId || !ids.has(e.taskId));
    await writeAll(kept);
    return all.length - kept.length;
  });
}
