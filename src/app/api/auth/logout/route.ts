import { NextResponse } from "next/server";
import { SESSION_COOKIE, destroyDemoSession, sessionToken } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/security";

export async function POST() {
  destroyDemoSession(await sessionToken());
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
