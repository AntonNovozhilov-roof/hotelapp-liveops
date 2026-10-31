import type {
  AiCheckItem,
  Department,
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
const MODEL_BASE_URL = "https://api.meta.ai/v1";
const REQUEST_TIMEOUT_MS = 60_000;

/** Below this SAM confidence a check is "not sure", never pass or fail. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

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
  const response = await fetch(`${MODEL_BASE_URL}/responses`, {
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`SAM API returned HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  return parseSamOutput(extractOutputText(data));
}

function statusFor(
  count: number,
  confidence: number | null,
): AiCheckItem["status"] {
  if (count === 0) return "not_found";
  if (confidence === null || confidence < LOW_CONFIDENCE_THRESHOLD) {
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
  return buildAiCheck(checks, `${SAM_MODEL} (MOCK — not called)`, "MOCK", [
    "This is a MOCK result — no AI checked this photo. A person must look at the photo.",
  ]);
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
): Promise<TaskAiCheck> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");

  const checks: AiCheckItem[] = [];
  for (const def of PHOTO_CHECKS[department]) {
    let count = 0;
    let confidence: number | null = null;
    for (const { dataUrl } of photos) {
      const result = await segmentConcept(apiKey, def.prompt, dataUrl);
      count += result.count;
      if (
        result.confidence !== null &&
        (confidence === null || result.confidence > confidence)
      ) {
        confidence = result.confidence;
      }
      // One confident find is enough for this check: save the extra calls.
      if (statusFor(count, confidence) === "found") break;
    }
    checks.push({
      key: def.key,
      label: def.label,
      status: statusFor(count, confidence),
      confidence,
      count,
    });
  }

  return buildAiCheck(checks, SAM_MODEL, "LIVE");
}
