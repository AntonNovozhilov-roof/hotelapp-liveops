import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import {
  DEMO_PASSWORD,
  findDemoUser,
  toPublicUser,
  type DemoUser,
  type PublicUser,
} from "./users";

/**
 * Server-side demo sessions (D2 / ANT-38).
 *
 * Sign-in checks the demo password on the server and stores the session
 * here, in server memory; the browser only gets a random httpOnly cookie.
 * A server restart signs everyone out (fine for the demo). Real accounts
 * and hashed passwords come with the database in M2.
 */

export const SESSION_COOKIE = "hotelapp_session";

type SessionStore = Map<string, string>; // token -> username

const globalStore = globalThis as typeof globalThis & {
  __hotelDemoSessions?: SessionStore;
};

function sessions(): SessionStore {
  if (!globalStore.__hotelDemoSessions) {
    globalStore.__hotelDemoSessions = new Map();
  }
  return globalStore.__hotelDemoSessions;
}

export function checkDemoCredentials(
  username: string,
  password: string,
): DemoUser | null {
  const user = findDemoUser(username);
  if (!user || password !== DEMO_PASSWORD) return null;
  return user;
}

export function createDemoSession(user: DemoUser): string {
  const token = randomUUID();
  sessions().set(token, user.username);
  return token;
}

export function destroyDemoSession(token: string | null): void {
  if (token) sessions().delete(token);
}

export async function sessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** The signed-in demo user for this request, or null. Server only. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await sessionToken();
  if (!token) return null;
  const username = sessions().get(token);
  if (!username) return null;
  const user = findDemoUser(username);
  return user ? toPublicUser(user) : null;
}
