import { createHash } from "crypto";
import { dbQuery, isDbEnabled } from "./db";
import type {
  AiCheckItem,
  Department,
  SparkOpinion,
  TaskAiCheck,
  TaskPhoto,
} from "./tasks";

/**
 * AI photo check with SAM 3.1 (Meta Model API) — M5 / ANT-21.
 *
 * Official docs (read before changing the wire format, do not guess):
 * - https://dev.meta.ai/docs/sam/overview — model `sam-3.1`,
 *   POST /v1/responses on https://api.meta.ai/v1, Bearer MODEL_API_KEY
 * - https://dev.meta.ai/docs/sam/segmenting — one short noun-phrase concept
 *   per request (several concepts = several requests); the image goes in an
 *   `input_image` part as a public URL or a base64 data URL;
 *   metadata.include_confidence: "true" (a string) adds `c` (0..1) to every
 *   box/mask; zero matches is a valid result: the output text is empty
 * - https://dev.meta.ai/docs/sam/reading-segmentation — the result text is
 *   `text<0f>id<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..[;c=..]|><|mask;...|>`
 *   per match; a non-streaming call returns that text in the Responses
 *   `output[].content[].text`
 *
 * SAM only finds objects. It does not judge the work and it never approves
 * anything: the saved result helps the supervisor, who still decides.
 */

export const SAM_MODEL = "sam-3.1";
/** Official Meta Model API base. META_API_BASE_URL exists only so tests
 * can point at a local stub (e.g. simulated SAM 503); unset in real use. */
const MODEL_BASE_URL = process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1";
const REQUEST_TIMEOUT_MS = 30_000;

/* ------------------------------------------------------------------ */
/* PC1 part 3: retries, per-photo cache, concurrency, live progress.  */
/* ------------------------------------------------------------------ */

/** Retry on 5xx/timeout only: up to maxRetries extra tries, then throw. */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= PHOTO_CHECK_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status < 500 || attempt === PHOTO_CHECK_CONFIG.maxRetries) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === PHOTO_CHECK_CONFIG.maxRetries) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

/** Same photo + prompt is never checked twice (in-memory, bounded). */
const samCache = new Map<string, { count: number; confidence: number | null }>();
const sparkCache = new Map<string, SparkOpinion>();
const CACHE_LIMIT = 300;

function cacheSet<V>(cache: Map<string, V>, key: string, value: V): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

/**
 * M2: in database mode the same cache also lives in `photo_check_cache`,
 * so a photo + prompt checked on one server is never re-checked on
 * another. The in-memory map stays as the fast first level in both modes.
 */
import demoCacheJson from "./demo-photo-cache.json";
const DEMO_CACHE = demoCacheJson as unknown as { sam: Record<string, unknown>; spark: Record<string, unknown> };

async function cacheGetDb<V>(kind: string, key: string, mem: Map<string, V>): Promise<V | undefined> {
  const hit = mem.get(key);
  if (hit !== undefined) return hit;
  const bundled = (kind === "sam" ? DEMO_CACHE.sam[key] : DEMO_CACHE.spark[key]) as V | undefined;
  if (bundled !== undefined) { cacheSet(mem, key, bundled); return bundled; }
  if (!isDbEnabled()) return undefined;
  try {
    const rows = await dbQuery<{ result: V }>(
      "SELECT result FROM photo_check_cache WHERE kind = $1 AND cache_key = $2",
      [kind, key],
    );
    if (!rows.length) return undefined;
    cacheSet(mem, key, rows[0].result);
    return rows[0].result;
  } catch { return undefined; }
}

/** One-time precompute export (bundled demo cache generation). */
export function exportDemoPhotoCache(): { sam: Record<string, unknown>; spark: Record<string, unknown> } {
  return { sam: Object.fromEntries(samCache), spark: Object.fromEntries(sparkCache) };
}
export function demoDataUrlHash(dataUrl: string): string { return dataUrlHash(dataUrl); }

async function cacheSetDb<V>(kind: string, key: string, value: V, mem: Map<string, V>): Promise<void> {
  cacheSet(mem, key, value);
  if (!isDbEnabled()) return;
  try {
    await dbQuery(
      `INSERT INTO photo_check_cache (kind, cache_key, result) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (kind, cache_key) DO UPDATE SET result = EXCLUDED.result, created_at = now()`,
      [kind, key, JSON.stringify(value)],
    );
  } catch { /* the AI check itself must never fail because of its cache */ }
}

/** Admin restore only: forget every cached check result (memory + DB table). */
export async function clearPhotoCheckCache(): Promise<void> {
  samCache.clear();
  sparkCache.clear();
  if (isDbEnabled()) {
    try { await dbQuery("DELETE FROM photo_check_cache"); } catch { /* cache only */ }
  }
}

function dataUrlHash(dataUrl: string): string {
  return createHash("sha256").update(dataUrl).digest("hex");
}

/** Tiny semaphore: at most `concurrency` SAM/Spark calls in flight. */
let inFlight = 0;
const waiters: Array<() => void> = [];
async function withConcurrency<T>(work: () => Promise<T>): Promise<T> {
  if (inFlight >= PHOTO_CHECK_CONFIG.concurrency) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  } else {
    inFlight += 1;
  }
  try {
    return await work();
  } finally {
    const next = waiters.shift();
    if (next) next();
    else inFlight -= 1;
  }
}

/** Live progress for the staff screen: "Checking photo… 3 of 9 items". */
export interface CheckProgress {
  done: number;
  total: number;
  startedAt: number;
}
const progressByTask = new Map<string, CheckProgress>();

export function beginCheckProgress(taskId: string): void {
  progressByTask.set(taskId, { done: 0, total: 0, startedAt: Date.now() });
}
export function updateCheckProgress(
  taskId: string,
  done: number,
  total: number,
): void {
  const current = progressByTask.get(taskId);
  if (current) progressByTask.set(taskId, { ...current, done, total });
}
export function endCheckProgress(taskId: string): void {
  progressByTask.delete(taskId);
}
export function getCheckProgress(taskId: string): CheckProgress | null {
  return progressByTask.get(taskId) ?? null;
}

/**
 * PC1 — THE one place for photo-check items, prompts and thresholds.
 *
 * The "found" bar is 0.80 because the colleague's false towel (ANT-65)
 * scored 0.74–0.79: below 0.80 an item is "unsure", never "found".
 * "Looks ready" (verdict ready) needs SAM all-found AND Spark ready with
 * confidence >= 0.70. Auto-approve needs both higher (see below) and the
 * owner setting (off by default).
 */
export const PHOTO_CHECK_CONFIG = {
  /** SAM confidence at/above which an item counts as found. */
  foundThreshold: 0.8,
  /** Spark confidence needed (with SAM all-found) for "Looks ready". */
  sparkReadyThreshold: 0.7,
  /** Auto-approve bars: SAM every item >= this AND Spark >= sparkAutoApprove. */
  autoApproveSamThreshold: 0.8,
  autoApproveSparkThreshold: 0.85,
  /**
   * Reference-relative bar (PC1 tuning): when the perfect photo itself
   * scored an item low (e.g. towel art at 0.70), the cleaner photo counts
   * as found within this slack of the reference confidence — but never
   * below 0.50, and never above the absolute 0.80 bar. With a reference
   * towel at 0.90 the bar is 0.75, so the ANT-65 false towel (0.74) and
   * the no-reference false towels (0.79 vs the absolute 0.80) still fail.
   */
  referenceConfidenceSlack: 0.15,
  /** Part 3: max SAM/Spark requests running at once. */
  concurrency: 6,
  /** Part 3: extra tries on 5xx/timeout (2 retries = 3 attempts). */
  maxRetries: 2,
} as const;

/** Below this SAM confidence a check is "not sure", never pass or fail. */
export const LOW_CONFIDENCE_THRESHOLD = PHOTO_CHECK_CONFIG.foundThreshold;

/**
 * Prompt variations for key items (PC1): SAM gets each phrasing and the
 * best result wins, so towels at a new angle/lighting (ANT-66) still count.
 * Keys match AiCheckItem keys (singular/plural spellings included).
 */
export const KEY_ITEM_PROMPTS: Record<string, string[]> = {
  towel: ["towel", "bath towel", "folded towel", "hanging towel"],
  towels: ["towel", "bath towel", "folded towel", "hanging towel"],
  pillow: ["pillow", "bed pillow", "pillow on a bed"],
  bed: ["bed", "made bed", "bed with pillows"],
};

/** All SAM prompts to try for one check def (variations for key items). */
export function promptsFor(def: PhotoCheckDef): string[] {
  const variations =
    KEY_ITEM_PROMPTS[def.key.toLowerCase()] ??
    KEY_ITEM_PROMPTS[def.label.toLowerCase()];
  if (!variations) return [def.prompt];
  return [...new Set([def.prompt, ...variations])];
}

export interface PhotoCheckDef {
  key: string;
  /** Plain name shown to staff. */
  label: string;
  /** The SAM concept prompt: one short noun phrase (docs: concrete noun). */
  prompt: string;
}

/**
 * THE check list — the one place to change what the AI looks for.
 * Keep it short: 2–3 objects per department. One entry = one SAM request
 * per photo, so a long list makes every check slower and costlier.
 */
export const PHOTO_CHECKS: Record<Department, PhotoCheckDef[]> = {
  housekeeping: [
    { key: "bed", label: "Bed", prompt: "bed" },
    { key: "towels", label: "Towels", prompt: "towel" },
    { key: "pillow", label: "Pillow", prompt: "pillow" },
  ],
  maintenance: [
    { key: "sink", label: "Sink", prompt: "sink" },
    { key: "toilet", label: "Toilet", prompt: "toilet" },
  ],
  front_desk: [
    { key: "desk", label: "Desk", prompt: "desk" },
    { key: "chair", label: "Chair", prompt: "chair" },
  ],
  room_service: [
    { key: "tray", label: "Tray", prompt: "tray" },
    { key: "plate", label: "Plate", prompt: "plate" },
    { key: "cup", label: "Cup", prompt: "cup" },
  ],
};

/**
 * Broad fallback room item list (P1) — THE one place to change it.
 * Used when Muse Spark cannot list the objects in the perfect photo
 * (or in MOCK mode). Never only towels and pillows: the whole room.
 */
export const BROAD_ROOM_ITEMS: PhotoCheckDef[] = [
  { key: "bed", label: "Bed", prompt: "bed" },
  { key: "pillow", label: "Pillow", prompt: "pillow" },
  { key: "blanket", label: "Blanket", prompt: "blanket" },
  { key: "towel", label: "Towel", prompt: "towel" },
  { key: "lamp", label: "Lamp", prompt: "lamp" },
  { key: "chair", label: "Chair", prompt: "chair" },
  { key: "table", label: "Table", prompt: "table" },
  { key: "curtain", label: "Curtain", prompt: "curtain" },
  { key: "trash_bin", label: "Trash bin", prompt: "trash bin" },
  { key: "bottle", label: "Bottle", prompt: "bottle" },
  { key: "cup", label: "Cup", prompt: "cup" },
  { key: "mirror", label: "Mirror", prompt: "mirror" },
  { key: "tv", label: "TV", prompt: "television" },
  { key: "rug", label: "Rug", prompt: "rug" },
  { key: "sink", label: "Sink", prompt: "sink" },
  { key: "toilet", label: "Toilet", prompt: "toilet" },
];

const VISION_MODEL = "muse-spark-1.3";

/**
 * Ask Muse Spark (image understanding, https://dev.meta.ai/docs/image-understanding)
 * to list the objects it sees in the perfect-room photos. Returns check
 * defs, or null when the model cannot give a usable list.
 */
export async function listRoomItemsFromPhotos(
  dataUrls: string[],
): Promise<PhotoCheckDef[] | null> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey || dataUrls.length === 0) return null;
  try {
    const response = await fetchWithRetry(`${MODEL_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'List the main objects you can see in these hotel room photos. Reply with ONLY a JSON array of short lowercase object names, for example ["bed","pillow","towel","lamp"]. Max 12 objects. No other text.',
              },
              ...dataUrls.map((url) => ({
                type: "image_url",
                image_url: { url },
              })),
            ],
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : "";
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end <= start) return null;
    const names = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (!Array.isArray(names)) return null;
    const defs: PhotoCheckDef[] = [];
    const seen = new Set<string>();
    for (const raw of names) {
      if (typeof raw !== "string") continue;
      const name = raw.toLowerCase().trim();
      // Map the model's words onto the broad list when possible so SAM
      // prompts stay concrete nouns; otherwise keep the model's noun.
      const broad = BROAD_ROOM_ITEMS.find(
        (item) =>
          name === item.key ||
          name === item.label.toLowerCase() ||
          name.includes(item.label.toLowerCase()) ||
          item.label.toLowerCase().includes(name),
      );
      const def = broad ?? {
        key: name.replace(/[^a-z0-9]+/g, "_").slice(0, 30),
        label: name,
        prompt: name.slice(0, 40),
      };
      if (!def.key || seen.has(def.key)) continue;
      seen.add(def.key);
      defs.push(def);
      if (defs.length >= 12) break;
    }
    return defs.length >= 2 ? defs : null;
  } catch {
    return null;
  }
}

/** The "found" bar for one item, relative to its reference confidence. */
function foundThresholdFor(referenceConfidence: number | null | undefined): number {
  if (referenceConfidence === null || referenceConfidence === undefined) {
    return PHOTO_CHECK_CONFIG.foundThreshold;
  }
  return Math.min(
    PHOTO_CHECK_CONFIG.foundThreshold,
    Math.max(0.5, referenceConfidence - PHOTO_CHECK_CONFIG.referenceConfidenceSlack),
  );
}

/** One item's best SAM result across prompts/photos (photos in parallel). */
async function bestSamForDef(
  apiKey: string,
  def: PhotoCheckDef,
  dataUrls: string[],
  expectedCount: number | null,
  referenceConfidence: number | null | undefined,
): Promise<{ count: number; confidence: number | null }> {
  let count = 0;
  let confidence: number | null = null;
  const threshold = foundThresholdFor(referenceConfidence);
  for (const prompt of promptsFor(def)) {
    const results = await Promise.all(
      dataUrls.map((dataUrl) => segmentConcept(apiKey, prompt, dataUrl)),
    );
    for (const result of results) {
      // Count = the most seen in one photo; confidence = that result's best.
      if (
        result.count > count ||
        (result.count === count &&
          result.count > 0 &&
          (confidence === null ||
            (result.confidence !== null && result.confidence > confidence)))
      ) {
        count = result.count;
        confidence = result.confidence;
      } else if (count === 0 && result.confidence !== null) {
        if (confidence === null || result.confidence > confidence) {
          confidence = result.confidence;
        }
      }
    }
    // Early exit: confidently found enough of the item — skip variations.
    if (
      count > 0 &&
      confidence !== null &&
      confidence >= threshold &&
      (expectedCount === null || count >= expectedCount)
    ) {
      break;
    }
  }
  return { count, confidence };
}

/** Run SAM for each def over combined photos (found = confident in any). */
export async function runSamOverPhotos(
  defs: PhotoCheckDef[],
  dataUrls: string[],
  options?: {
    /** Perfect-photo counts by item key: fewer found = "AI not sure" (PC1). */
    expectedCounts?: Map<string, number>;
    /** Perfect-photo SAM confidence per item key (reference-relative bar). */
    referenceConfidences?: Map<string, number | null>;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<AiCheckItem[]> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");
  let done = 0;
  // PC1 part 3: items run in parallel (shared ~6-in-flight limit inside
  // segmentConcept); progress fires as each item finishes.
  const checks = await Promise.all(
    defs.map(async (def) => {
      const expected = options?.expectedCounts?.get(def.key) ?? null;
      const referenceConfidence =
        options?.referenceConfidences?.get(def.key) ?? null;
      const { count, confidence } = await bestSamForDef(
        apiKey,
        def,
        dataUrls,
        expected,
        referenceConfidence,
      );
      let status = statusFor(
        count,
        confidence,
        foundThresholdFor(referenceConfidence),
      );
      // PC1: fewer of an item than the perfect photo -> "AI not sure",
      // never a pass (e.g. 1 pillow instead of 2).
      if (expected !== null && count > 0 && count < expected) {
        status = "unsure";
      }
      done += 1;
      options?.onProgress?.(done, defs.length);
      return {
        key: def.key,
        label: def.label,
        status,
        confidence,
        count,
        expectedCount: expected,
      } as AiCheckItem;
    }),
  );
  return checks;
}

export type AiVerdict = "ready" | "different" | "unsure";

/** Simple verdict from items: low confidence is "not sure", never pass/fail. */
export function verdictFor(
  checks: AiCheckItem[],
): { verdict: AiVerdict; highConfidence: boolean } {
  if (checks.length === 0) return { verdict: "unsure", highConfidence: false };
  if (checks.some((c) => c.status === "not_found")) {
    return { verdict: "different", highConfidence: false };
  }
  if (checks.some((c) => c.status === "unsure")) {
    return { verdict: "unsure", highConfidence: false };
  }
  const high = checks.every(
    (c) =>
      c.confidence !== null &&
      c.confidence >= PHOTO_CHECK_CONFIG.autoApproveSamThreshold,
  );
  return { verdict: "ready", highConfidence: high };
}

/**
 * Check a perfect-room reference once and cache the result (P1):
 * Muse Spark lists the objects, SAM 3.1 finds/counts them. Falls back
 * to BROAD_ROOM_ITEMS. No key = MOCK (all unsure).
 */
export async function runReferenceCheck(
  dataUrls: string[],
): Promise<{
  items: AiCheckItem[];
  itemSource: "vision" | "broad" | "mock";
  model: string;
}> {
  if (!process.env.MODEL_API_KEY) {
    return {
      items: BROAD_ROOM_ITEMS.map((def) => ({
        key: def.key,
        label: def.label,
        status: "unsure" as const,
        confidence: null,
        count: 0,
      })),
      itemSource: "mock",
      model: `${SAM_MODEL} (MOCK — not called)`,
    };
  }
  const visionDefs = await listRoomItemsFromPhotos(dataUrls);
  const defs = visionDefs ?? BROAD_ROOM_ITEMS;
  const items = await runSamOverPhotos(defs, dataUrls);
  return {
    items,
    itemSource: visionDefs ? "vision" : "broad",
    model: SAM_MODEL,
  };
}

/**
 * Compare cleaner photos with the room's active reference (P1): combine
 * all photos on each side. Only items confidently found in the perfect
 * photo are compared. Item details stay system-only (never shown).
 */
export async function compareWithReference(
  cleanerDataUrls: string[],
  referenceItems: AiCheckItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<TaskAiCheck> {
  const considered = referenceItems.filter((item) => item.status === "found");
  if (!process.env.MODEL_API_KEY) {
    const check = mockAiCheck("housekeeping");
    return {
      ...check,
      verdict: "unsure",
      comparedToReference: true,
      highConfidence: false,
    };
  }
  if (considered.length === 0) {
    return {
      score: 0,
      checks: [],
      issues: [],
      model: SAM_MODEL,
      mode: "LIVE",
      checkedAt: new Date().toISOString(),
      verdict: "unsure",
      comparedToReference: true,
      highConfidence: false,
    };
  }
  const defs = considered.map((item) => {
    const broad = BROAD_ROOM_ITEMS.find((b) => b.key === item.key);
    return {
      key: item.key,
      label: item.label,
      prompt: broad?.prompt ?? item.label,
    };
  });
  const expectedCounts = new Map(
    considered.map((item) => [item.key, item.count] as const),
  );
  const referenceConfidences = new Map(
    considered.map((item) => [item.key, item.confidence] as const),
  );
  const checks = await runSamOverPhotos(defs, cleanerDataUrls, {
    expectedCounts,
    referenceConfidences,
    onProgress,
  });
  const base = buildAiCheck(checks, SAM_MODEL, "LIVE");
  const { verdict, highConfidence } = verdictFor(checks);
  return { ...base, verdict, comparedToReference: true, highConfidence };
}

/**
 * PC1 second opinion: one muse-spark-1.3 image-understanding call per
 * check. Sends the perfect photo(s) first, then the cleaner's photo(s),
 * and asks for strict JSON {ready, differences, confidence}. Returns null
 * when Spark cannot answer — the fusion then says "AI not sure", never
 * "Looks ready".
 */
export async function runSecondOpinion(
  perfectDataUrls: string[],
  cleanerDataUrls: string[],
): Promise<SparkOpinion | null> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey || cleanerDataUrls.length === 0) return null;
  const cacheKey = [...perfectDataUrls, "|", ...cleanerDataUrls]
    .map(dataUrlHash)
    .join("|");
  const cached = await cacheGetDb("spark", cacheKey, sparkCache);
  if (cached) return cached;
  try {
    const response = await withConcurrency(() =>
      fetchWithRetry(`${MODEL_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    perfectDataUrls.length > 0
                      ? 'The first photo(s) show a hotel room cleaned perfectly (the reference). The last photo(s) show the same room after cleaning. Compare them strictly. Reply with ONLY JSON, no markdown: {"ready":true,"differences":[],"confidence":0.9}. ready is true only if the cleaned room matches the perfect room (bed made, towels present, nothing left on the floor, no missing items). differences is a short list like ["towels missing","bed not made","items left on the floor"] — empty when ready. confidence is 0 to 1.'
                      : 'These photo(s) show a hotel room after cleaning. Judge strictly whether the room looks ready for a guest (bed made, towels present, nothing left on the floor, no clutter). Reply with ONLY JSON, no markdown: {"ready":true,"differences":[],"confidence":0.9}. differences is a short list like ["towels missing","bed not made","items left on the floor"] — empty when ready. confidence is 0 to 1.',
                },
                ...perfectDataUrls.map((url) => ({
                  type: "image_url",
                  image_url: { url },
                })),
                ...cleanerDataUrls.map((url) => ({
                  type: "image_url",
                  image_url: { url },
                })),
              ],
            },
          ],
        }),
      }),
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    const opinion = parseSparkOpinion(typeof content === "string" ? content : "");
    if (opinion) await cacheSetDb("spark", cacheKey, opinion, sparkCache);
    return opinion;
  } catch {
    return null;
  }
}

/** Parse Spark's strict JSON (tolerates a markdown fence / extra words). */
export function parseSparkOpinion(text: string): SparkOpinion | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (typeof raw.ready !== "boolean") return null;
    const confidence =
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.min(1, Math.max(0, raw.confidence))
        : 0;
    const differences = Array.isArray(raw.differences)
      ? raw.differences
          .filter((d): d is string => typeof d === "string")
          .map((d) => d.trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    return { ready: raw.ready, differences, confidence };
  } catch {
    return null;
  }
}

/** One plain hint line for the cleaner from Spark differences. No numbers. */
export function hintFromDifferences(differences: string[]): string | null {
  const cleaned = differences
    .map((d) => d.replace(/[0-9]/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);
  if (cleaned.length === 0) return null;
  return `Check: ${cleaned.join(", ")}`;
}

/**
 * PC1 final verdict — SAM items + Spark second opinion fused:
 * - Spark lists differences -> "different" (Not ready yet; a retry fail).
 * - "ready" only when SAM found everything (no count shortfall) AND
 *   Spark says ready with confidence >= sparkReadyThreshold.
 * - Any disagreement or low confidence -> "unsure" (AI not sure): goes
 *   to the supervisor and never counts as a pass.
 * Auto-approve (highConfidence) needs SAM all >= autoApproveSamThreshold
 * AND Spark >= autoApproveSparkThreshold.
 */
export function fuseWithSpark(
  check: TaskAiCheck,
  spark: SparkOpinion | null,
): TaskAiCheck {
  const samVerdict = check.verdict ?? verdictFor(check.checks).verdict;
  const hint = spark ? hintFromDifferences(spark.differences) : null;
  if (!spark) {
    // No second opinion: never upgrade to a pass.
    return {
      ...check,
      verdict: samVerdict === "ready" ? "unsure" : samVerdict,
      highConfidence: false,
      spark: null,
      hint: null,
    };
  }
  if (spark.differences.length > 0) {
    return { ...check, verdict: "different", highConfidence: false, spark, hint };
  }
  if (!spark.ready) {
    return {
      ...check,
      verdict: samVerdict === "different" ? "different" : "unsure",
      highConfidence: false,
      spark,
      hint,
    };
  }
  if (spark.confidence < PHOTO_CHECK_CONFIG.sparkReadyThreshold) {
    return { ...check, verdict: "unsure", highConfidence: false, spark, hint };
  }
  if (samVerdict !== "ready") {
    // Spark is happy but SAM is not (or counts fell short): disagreement.
    return { ...check, verdict: "unsure", highConfidence: false, spark, hint };
  }
  const samHigh = check.checks.every(
    (c) =>
      c.confidence !== null &&
      c.confidence >= PHOTO_CHECK_CONFIG.autoApproveSamThreshold,
  );
  return {
    ...check,
    verdict: "ready",
    highConfidence:
      samHigh && spark.confidence >= PHOTO_CHECK_CONFIG.autoApproveSparkThreshold,
    spark,
    hint: null,
  };
}

/** Count SAM box records in one output text and take the best confidence. */
export function parseSamOutput(text: string): {
  count: number;
  confidence: number | null;
} {
  let count = 0;
  let best: number | null = null;
  for (const match of text.matchAll(/<\|box;([^|]*)\|>/g)) {
    count += 1;
    const confMatch = /(?:^|;)c=([0-9]+(?:\.[0-9]+)?)/.exec(match[1]);
    if (confMatch) {
      const value = Number(confMatch[1]);
      if (Number.isFinite(value) && (best === null || value > best)) {
        best = value;
      }
    }
  }
  return { count, confidence: best };
}

/** The Responses API puts the SAM text in output[].content[].text. */
export function extractOutputText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  const parts: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const partRecord = part as Record<string, unknown>;
      if (partRecord.type === "output_text" && typeof partRecord.text === "string") {
        parts.push(partRecord.text);
      }
    }
  }
  return parts.join("");
}

/** One SAM request: find one concept in one photo. Throws on any API error. */
async function segmentConcept(
  apiKey: string,
  prompt: string,
  dataUrl: string,
): Promise<{ count: number; confidence: number | null }> {
  const cacheKey = `${dataUrlHash(dataUrl)}|${prompt}`;
  const cached = await cacheGetDb("sam", cacheKey, samCache);
  if (cached) return cached;
  const result = await withConcurrency(async () => {
    const response = await fetchWithRetry(`${MODEL_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: SAM_MODEL,
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: dataUrl },
            ],
          },
        ],
        metadata: { include_confidence: "true", mask_encoding: "one_bit" },
      }),
    });
    if (!response.ok) {
      throw new Error(`SAM API returned HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    return parseSamOutput(extractOutputText(data));
  });
  await cacheSetDb("sam", cacheKey, result, samCache);
  return result;
}

function statusFor(
  count: number,
  confidence: number | null,
  threshold: number = LOW_CONFIDENCE_THRESHOLD,
): AiCheckItem["status"] {
  if (count === 0) return "not_found";
  if (confidence === null || confidence < threshold) {
    return "unsure";
  }
  return "found";
}

/** Turn the per-check results into the saved shape: score + plain issues. */
export function buildAiCheck(
  checks: AiCheckItem[],
  model: string,
  mode: TaskAiCheck["mode"],
  extraIssues: string[] = [],
): TaskAiCheck {
  const points = checks.reduce((sum, check) => {
    if (check.status === "found") return sum + 1;
    if (check.status === "unsure") return sum + 0.5;
    return sum;
  }, 0);
  const score =
    checks.length === 0 ? 0 : Math.round((points / checks.length) * 100);

  // One short line, e.g. "Not found: bed, towels, pillow. Fix the room
  // and take a new photo." (T1) — not one sentence per missing item.
  const issues = [...extraIssues];
  const notFound = checks
    .filter((check) => check.status === "not_found")
    .map((check) => check.label.toLowerCase());
  const unsure =
    mode === "LIVE"
      ? checks
          .filter((check) => check.status === "unsure")
          .map((check) => check.label.toLowerCase())
      : [];
  if (notFound.length > 0) {
    const unsurePart =
      unsure.length > 0 ? ` Not sure: ${unsure.join(", ")}.` : "";
    issues.push(
      `Not found: ${notFound.join(", ")}.${unsurePart} Fix the room and take a new photo.`,
    );
  } else if (unsure.length > 0) {
    issues.push(
      `Not sure: ${unsure.join(", ")}. A person should look at the photo.`,
    );
  }

  return {
    score,
    checks,
    issues,
    model,
    mode,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Fake result used when there is no key or SAM cannot be reached, so the
 * flow still works. Clearly marked MOCK everywhere; every check is
 * "not sure" because no AI really looked at the photo.
 */
export function mockAiCheck(department: Department): TaskAiCheck {
  const checks: AiCheckItem[] = PHOTO_CHECKS[department].map((def) => ({
    key: def.key,
    label: def.label,
    status: "unsure",
    confidence: null,
    count: 0,
  }));
  const base = buildAiCheck(checks, `${SAM_MODEL} (MOCK — not called)`, "MOCK", [
    "This is a MOCK result — no AI checked this photo. A person must look at the photo.",
  ]);
  return { ...base, verdict: "unsure", comparedToReference: false, highConfidence: false };
}

/**
 * Run the department checks for a task over its photos (data URLs built by
 * the caller from the saved photo files). A check is "found" when SAM finds
 * the object confidently in any one photo. Throws when SAM fails, so the
 * caller can fall back to the MOCK result.
 */
export async function runLivePhotoCheck(
  department: Department,
  photos: { photo: TaskPhoto; dataUrl: string }[],
  onProgress?: (done: number, total: number) => void,
): Promise<TaskAiCheck> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");

  const checks = await runSamOverPhotos(
    PHOTO_CHECKS[department],
    photos.map((p) => p.dataUrl),
    { onProgress },
  );
  const base = buildAiCheck(checks, SAM_MODEL, "LIVE");
  const { verdict, highConfidence } = verdictFor(checks);
  return { ...base, verdict, comparedToReference: false, highConfidence };
}
