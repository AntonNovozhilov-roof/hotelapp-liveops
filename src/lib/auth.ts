import { cookies } from "next/headers";
import {
  DEMO_PASSWORD,
  findDemoUser,
  toPublicUser,
  type DemoUser,
  type PublicUser,
} from "./users";
import {
  SESSION_COOKIE,
  createSessionToken,
  usernameFromSessionToken,
} from "./security";

export { SESSION_COOKIE };

/**
 * Server-side demo sessions (D2 / ANT-38, SEC1 / ANT-57).
 *
 * Sign-in checks the demo password on the server. The browser gets a signed
 * httpOnly cookie (HMAC with SESSION_SECRET, 12 hour expiry, SameSite=Lax,
 * Secure in production) — there is no server-side session list, so sign-in
 * survives a server restart until the cookie expires. Real accounts and
 * hashed passwords come with the database in M2.
 */

export function checkDemoCredentials(
  username: string,
  password: string,
): DemoUser | null {
  const user = findDemoUser(username);
  if (!user || password !== DEMO_PASSWORD) return null;
  return user;
}

export function createDemoSession(user: DemoUser): string {
  return createSessionToken(user.username);
}

/** Signed cookies are stateless: logout is just clearing the cookie. */
export function destroyDemoSession(_token: string | null): void {
  // Nothing stored server-side, so nothing to delete.
}

export async function sessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** The signed-in demo user for this request, or null. Server only. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await sessionToken();
  const username = usernameFromSessionToken(token);
  if (!username) return null;
  const user = findDemoUser(username);
  return user ? toPublicUser(user) : null;
}
