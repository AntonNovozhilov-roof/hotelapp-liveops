import * as fs from "fs";
import path from "path";

/**
 * AI usage counters (G3 / ANT-62) — THE one place (.data/ai-usage.json;
 * M2 moves it to the database). One bucket per day, split by kind, so the
 * Owner card can show today and this month. Only real (LIVE) AI calls are
 * counted — MOCK answers never reach the recording point.
 */

export type AiUsageKind = "guestChat" | "photoChecks" | "reports" | "voice";
export type AiUsageBucket = Record<AiUsageKind, number>;

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "ai-usage.json");

const EMPTY: AiUsageBucket = { guestChat: 0, photoChecks: 0, reports: 0, voice: 0 };

function readAll(): Record<string, AiUsageBucket> {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Record<string, Partial<AiUsageBucket>>;
    const out: Record<string, AiUsageBucket> = {};
    for (const [day, bucket] of Object.entries(parsed)) out[day] = { ...EMPTY, ...bucket };
    return out;
  } catch { return {}; }
}

/** Count one real AI call. Called from consumeAiCall, so the daily cap and the usage card can never drift apart. */
export function recordAiUsage(kind: AiUsageKind): void {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const all = readAll();
    all[day] = { ...EMPTY, ...(all[day] ?? {}), [kind]: (all[day]?.[kind] ?? 0) + 1 };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(all, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, DATA_FILE);
  } catch (error) {
    console.error("Could not save AI usage:", error instanceof Error ? error.message : "unknown error");
  }
}

export function getAiUsage(now = new Date()): { today: AiUsageBucket; month: AiUsageBucket } {
  const all = readAll();
  const todayKey = now.toISOString().slice(0, 10);
  const monthPrefix = todayKey.slice(0, 7);
  const month: AiUsageBucket = { ...EMPTY };
  for (const [day, bucket] of Object.entries(all)) {
    if (!day.startsWith(monthPrefix)) continue;
    for (const kind of Object.keys(EMPTY) as AiUsageKind[]) month[kind] += bucket[kind] ?? 0;
  }
  return { today: { ...EMPTY, ...(all[todayKey] ?? {}) }, month };
}
