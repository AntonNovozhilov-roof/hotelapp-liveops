import { NextResponse } from "next/server";
import { SESSION_COOKIE, checkDemoCredentials, createDemoSession, createSessionForUsername, employeeToPublicUser } from "@/lib/auth";
import { clearLoginFailures, foreignOriginResponse, isDemoMode, loginBlocked, recordLoginFailure, sessionCookieOptions } from "@/lib/security";
import { toPublicUser } from "@/lib/users";
import { getEmployeeByLogin, touchLastSignIn, verifyPassword } from "@/lib/employees";

/**
 * Sign-in (E1): real employees (scrypt hash) first; demo accounts only when
 * DEMO_MODE is on. 5 failed tries per minute per login, then a wait message.
 */
export async function POST(request: Request) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const record = (body ?? {}) as Record<string, unknown>;
  const username = typeof record.username === "string" ? record.username.trim().toLowerCase() : "";
  const password = typeof record.password === "string" ? record.password : "";
  if (!username || !password) return NextResponse.json({ error: "Enter your login and password." }, { status: 400 });

  if (loginBlocked(username)) {
    return NextResponse.json({ error: "Too many wrong passwords. Please wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  // Real employee account.
  const employee = await getEmployeeByLogin(username);
  if (employee) {
    if (!employee.active) return NextResponse.json({ error: "This account has been deactivated. Please ask the owner for help." }, { status: 403 });
    if (!verifyPassword(password, employee.passwordHash)) {
      recordLoginFailure(username);
      return NextResponse.json({ error: "That login and password do not match. Please try again." }, { status: 401 });
    }
    clearLoginFailures(username);
    await touchLastSignIn(employee.id);
    const user = employeeToPublicUser(employee);
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, createSessionForUsername(employee.login), sessionCookieOptions());
    return response;
  }

  // Demo accounts (DEMO_MODE only).
  const demo = checkDemoCredentials(username, password);
  if (demo) {
    clearLoginFailures(username);
    const token = createDemoSession(demo);
    const response = NextResponse.json({ user: toPublicUser(demo) });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  }
  recordLoginFailure(username);
  return NextResponse.json({ error: isDemoMode() ? "That login and password do not match. Please try again." : "That login and password do not match. Please try again." }, { status: 401 });
}
