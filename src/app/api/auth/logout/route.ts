import { NextResponse } from "next/server";
import { SESSION_COOKIE, destroyDemoSession, sessionToken } from "@/lib/auth";

export async function POST() {
  destroyDemoSession(await sessionToken());
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
