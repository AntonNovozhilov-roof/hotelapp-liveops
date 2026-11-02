import { NextResponse } from "next/server";
import { SESSION_COOKIE, checkDemoCredentials, createDemoSession } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/security";
import { toPublicUser } from "@/lib/users";
import { foreignOriginResponse } from "@/lib/security";

export async function POST(request: Request) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const username = typeof record.username === "string" ? record.username : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (!username.trim() || !password) {
    return NextResponse.json(
      { error: "Enter your demo username and the demo password." },
      { status: 400 },
    );
  }

  const user = checkDemoCredentials(username, password);
  if (!user) {
    return NextResponse.json(
      {
        error:
          "That username and password do not match a demo account. The demo password is shown on the sign-in page.",
      },
      { status: 401 },
    );
  }

  const token = createDemoSession(user);
  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
