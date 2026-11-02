import * as fs from "fs";
import path from "path";
import { dbQuery, isDbEnabled } from "./db";

/**
 * AI usage counters (G3 / ANT-62) — THE one place for these numbers.
 * File mode: .data/ai-usage.json. Database mode (M2 / ANT-18): the
 * `ai_usage_daily` table, one row per day and kind, incremented with one
 * atomic SQL statement so several servers can never lose a count. Only
 * real (LIVE) AI calls are counted — MOCK answers never reach here.
 */

export type AiUsageKind = "guestChat" | "photoChecks" | "reports" | "voice";
export type AiUsageBucket = Record<AiUsageKind, number>;

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "ai-usage.json");

const EMPTY: AiUsageBucket = { guestChat: 0, photoChecks: 0, reports: 0, voice: 0 };
const KINDS = Object.keys(EMPTY) as AiUsageKind[];

function readAllFile(): Record<string, AiUsageBucket> {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Record<string, Partial<AiUsageBucket>>;
    const out: Record<string, AiUsageBucket> = {};
    for (const [day, bucket] of Object.entries(parsed)) out[day] = { ...EMPTY, ...bucket };
    return out;
  } catch { return {}; }
}

/** Count one real AI call. Called from consumeAiCall, so the daily cap and the usage card can never drift apart. */
export async function recordAiUsage(kind: AiUsageKind): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  try {
    if (isDbEnabled()) {
      await dbQuery(
        `INSERT INTO ai_usage_daily (day, kind, count) VALUES ($1, $2, 1)
         ON CONFLICT (day, kind) DO UPDATE SET count = ai_usage_daily.count + 1`,
        [day, kind],
      );
      return;
    }
    const all = readAllFile();
    all[day] = { ...EMPTY, ...(all[day] ?? {}), [kind]: (all[day]?.[kind] ?? 0) + 1 };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(all, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, DATA_FILE);
  } catch (error) {
    console.error("Could not save AI usage:", error instanceof Error ? error.message : "unknown error");
  }
}

/** Admin restore only: wipe the usage counters (DB table or local file). */
export async function clearAiUsage(): Promise<void> {
  if (isDbEnabled()) {
    await dbQuery("DELETE FROM ai_usage_daily");
    return;
  }
  try { fs.rmSync(DATA_FILE, { force: true }); } catch { /* nothing saved yet */ }
}

export async function getAiUsage(now = new Date()): Promise<{ today: AiUsageBucket; month: AiUsageBucket }> {
  const todayKey = now.toISOString().slice(0, 10);
  const monthPrefix = todayKey.slice(0, 7);
  if (isDbEnabled()) {
    const rows = await dbQuery<{ day: string; kind: string; count: number }>(
      "SELECT to_char(day, 'YYYY-MM-DD') AS day, kind, count FROM ai_usage_daily WHERE to_char(day, 'YYYY-MM') = $1",
      [monthPrefix],
    );
    const today: AiUsageBucket = { ...EMPTY };
    const month: AiUsageBucket = { ...EMPTY };
    for (const row of rows) {
      if (!KINDS.includes(row.kind as AiUsageKind)) continue;
      const kind = row.kind as AiUsageKind;
      month[kind] += Number(row.count) || 0;
      if (row.day === todayKey) today[kind] += Number(row.count) || 0;
    }
    return { today, month };
  }
  const all = readAllFile();
  const month: AiUsageBucket = { ...EMPTY };
  for (const [day, bucket] of Object.entries(all)) {
    if (!day.startsWith(monthPrefix)) continue;
    for (const kind of KINDS) month[kind] += bucket[kind] ?? 0;
  }
  return { today: { ...EMPTY, ...(all[todayKey] ?? {}) }, month };
}
