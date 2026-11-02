import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Shared security helpers (SEC1 / ANT-57).
 *
 * Signed values are `<base64url JSON>.<base64url HMAC-SHA256>` and carry an
 * `exp` (unix seconds). The signing secret is SESSION_SECRET; a clearly
 * named development fallback keeps local `npm run dev` working before the
 * owner sets one (never use the fallback in production).
 */

export const SESSION_COOKIE = "hotelapp_session";
export const GUEST_COOKIE = "hotelapp_guest";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

function signingSecret(): string {
  return process.env.SESSION_SECRET || "hotelapp-dev-only-secret-set-SESSION_SECRET";
}

function sign(data: string): string {
  return createHmac("sha256", signingSecret()).update(data).digest("base64url");
}

export function signPayload(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyPayload<T extends Record<string, unknown>>(token: string | null | undefined): T | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: unknown };
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function expirySeconds(hours: number): number {
  return Math.floor(Date.now() / 1000) + hours * 60 * 60;
}

export function createSessionToken(username: string): string {
  return signPayload({ kind: "session", username, exp: expirySeconds(12) });
}

export function usernameFromSessionToken(token: string | null | undefined): string | null {
  const payload = verifyPayload<{ kind?: unknown; username?: unknown }>(token);
  if (!payload || payload.kind !== "session" || typeof payload.username !== "string") return null;
  return payload.username;
}

export interface GuestTokenData {
  room: string;
  taskIds: string[];
}

export function createGuestToken(room: string, taskIds: string[]): string {
  return signPayload({ kind: "guest", room, taskIds: [...new Set(taskIds)].slice(0, 100), exp: expirySeconds(12) });
}

export function guestDataFromToken(token: string | null | undefined): GuestTokenData | null {
  const payload = verifyPayload<{ kind?: unknown; room?: unknown; taskIds?: unknown }>(token);
  if (!payload || payload.kind !== "guest" || typeof payload.room !== "string") return null;
  return {
    room: payload.room,
    taskIds: Array.isArray(payload.taskIds) ? payload.taskIds.filter((id): id is string => typeof id === "string") : [],
  };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function guestCookieOptions() {
  return sessionCookieOptions();
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function isDemoResetAllowed(): boolean {
  return process.env.ALLOW_DEMO_RESET === "true";
}

/** Client IP for rate limits (first forwarded address, else a shared bucket). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

type RateStore = Map<string, number[]>;
const rateGlobal = globalThis as typeof globalThis & { __hotelRateLimits?: RateStore };

/** Simple in-memory sliding-window limit. Returns true when allowed. */
export function checkRateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  if (!rateGlobal.__hotelRateLimits) rateGlobal.__hotelRateLimits = new Map();
  const store = rateGlobal.__hotelRateLimits;
  const now = Date.now();
  const recent = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
}

export function rateLimitResponse(): NextResponse {
  return NextResponse.json(
    { error: "Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

type AiDailyStore = { day: string; count: number };
const aiGlobal = globalThis as typeof globalThis & { __hotelAiDaily?: AiDailyStore };

export function aiDailyLimit(): number {
  const parsed = Number.parseInt(process.env.AI_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
}

/**
 * Daily AI-call cap. Returns true (and counts the call) while under the cap.
 * In-memory on purpose for the hackathon: it resets on restart, like the
 * rate limits. When it returns false the caller must use a marked MOCK.
 */
export function consumeAiCall(label: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (!aiGlobal.__hotelAiDaily || aiGlobal.__hotelAiDaily.day !== day) {
    aiGlobal.__hotelAiDaily = { day, count: 0 };
  }
  const store = aiGlobal.__hotelAiDaily;
  if (store.count >= aiDailyLimit()) {
    console.log(`[AI_DAILY_LIMIT] Daily AI limit (${aiDailyLimit()}) reached; using MOCK for ${label}.`);
    return false;
  }
  store.count += 1;
  return true;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** True when a mutating request carries an Origin from another site. */
export function isForeignOrigin(request: Request): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const host = request.headers.get("host") || new URL(request.url).host;
    return originHost !== host;
  } catch {
    return true;
  }
}

export function foreignOriginResponse(request: Request): NextResponse | null {
  if (!isForeignOrigin(request)) return null;
  return NextResponse.json({ error: "This request was blocked because it came from another site." }, { status: 403 });
}

// ---- Login attempt limit (E1): 5 failed tries per minute per login ----
type FailStore = Map<string, number[]>;
const failGlobal = globalThis as typeof globalThis & { __hotelLoginFails?: FailStore };
function failStore(): FailStore { if (!failGlobal.__hotelLoginFails) failGlobal.__hotelLoginFails = new Map(); return failGlobal.__hotelLoginFails; }
export function loginBlocked(login: string): boolean {
  const now = Date.now();
  const recent = (failStore().get(login) ?? []).filter((x) => now - x < 60_000);
  failStore().set(login, recent);
  return recent.length >= 5;
}
export function recordLoginFailure(login: string): void {
  const store = failStore(); const now = Date.now();
  const recent = (store.get(login) ?? []).filter((x) => now - x < 60_000);
  recent.push(now); store.set(login, recent);
}
export function clearLoginFailures(login: string): void { failStore().delete(login); }
