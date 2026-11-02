import { NextResponse } from "next/server";
import { checkRateLimit, clientIp, foreignOriginResponse, rateLimitResponse } from "@/lib/security";
import { restoreCleanDemo, restoreEmptyHotel, restoreSecretConfigured, restoreSecretMatches } from "@/lib/restore";

/**
 * POST /api/admin/restore — wipe all hotel data and load a fresh demo
 * hotel. Gate: the RESTORE_SECRET code only (checked timing-safe on the
 * server). A sign-in is deliberately NOT enough — the demo owner password
 * is public. Max 5 tries per 10 minutes per visitor.
 * Body: {"code":"...","confirm":"RESTORE"}
 */
export async function POST(request: Request) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  if (!restoreSecretConfigured()) {
    return NextResponse.json({ error: "Restore is not set up on this copy (RESTORE_SECRET is missing)." }, { status: 503 });
  }
  if (!(await checkRateLimit(`restore:${clientIp(request)}`, 5, 10 * 60_000))) {
    return rateLimitResponse();
  }
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!restoreSecretMatches(body.code)) {
    console.log(`[restore] Rejected restore attempt at ${new Date().toISOString()} (wrong code).`);
    return NextResponse.json({ error: "That code is not right. Nothing was changed." }, { status: 403 });
  }
  if (body.confirm !== "RESTORE") {
    return NextResponse.json({ error: "Please type RESTORE to confirm. Nothing was changed." }, { status: 400 });
  }
  const mode = body.mode === "empty" ? "empty" : "demo";
  const counts = mode === "empty" ? await restoreEmptyHotel() : await restoreCleanDemo();
  return NextResponse.json({ ok: true, counts, mode });
}
