import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import type { RoleKey } from "./users";
import type { Department } from "./tasks";

/**
 * Employees (E1 / ANT-59) — THE one place for real staff accounts.
 * Stored in .data/employees.json (like tasks/hotel) so M2 (ANT-18) can
 * move only this file to the database. Passwords are ONLY scrypt hashes
 * (salt.hash, hex) — never plain text, never returned to the browser.
 */
export interface Employee {
  id: string;
  name: string;
  /** Login typed by the owner: lowercase letters, numbers, dot. Unique. */
  login: string;
  role: RoleKey;
  department: Department | null;
  passwordHash: string;
  active: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicEmployee = Omit<Employee, "passwordHash">;

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "employees.json");

let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}.${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(".");
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch { return false; }
}

const WORDS = ["sunny", "river", "maple", "harbor", "velvet", "copper", "meadow", "saffron", "cobalt", "willow", "amber", "breeze", "coral", "falcon", "garden", "hazel", "island", "juniper", "lagoon", "marble", "nectar", "olive", "pepper", "quartz", "rowan", "sierra", "tulip", "umber", "violet", "walnut", "yonder", "zephyr"];
const SYMBOLS = ["!", "#", "*", "?"];

/** Readable strong password, e.g. "Sunny-river-4832!" — shown ONCE at creation/reset. */
export function generatePassword(): string {
  const pick = <T,>(arr: T[]): T => arr[randomBytes(1)[0] % arr.length];
  const w1 = pick(WORDS); const w2 = pick(WORDS);
  const num = String(1000 + (randomBytes(2).readUInt16BE(0) % 9000));
  return `${w1[0].toUpperCase()}${w1.slice(1)}-${w2}-${num}${pick(SYMBOLS)}`;
}

export const LOGIN_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9]+)*$/;
export function validLogin(login: string): boolean {
  return login.length >= 3 && login.length <= 30 && LOGIN_PATTERN.test(login);
}
export function cleanLogin(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

async function readAll(): Promise<Employee[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is Employee => Boolean(e) && typeof e === "object" && typeof (e as Employee).id === "string" && typeof (e as Employee).login === "string" && typeof (e as Employee).passwordHash === "string");
  } catch { return []; }
}

async function writeAll(list: Employee[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(list, null, 2)}\n`, "utf8");
  await fs.rename(tmp, DATA_FILE);
}

export function toPublicEmployee(e: Employee): PublicEmployee {
  const { passwordHash: _hash, ...rest } = e;
  return rest;
}

export async function listEmployees(): Promise<Employee[]> {
  return (await readAll()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getEmployeeByLogin(login: string): Promise<Employee | null> {
  const norm = login.trim().toLowerCase();
  return (await readAll()).find((e) => e.login === norm) ?? null;
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  return (await readAll()).find((e) => e.id === id) ?? null;
}

export async function createEmployee(input: { name: string; login: string; role: RoleKey; department: Department | null; password: string }): Promise<{ ok: true; employee: Employee } | { ok: false; error: string }> {
  return withLock(async () => {
    const all = await readAll();
    if (all.some((e) => e.login === input.login)) {
      return { ok: false as const, error: `The login "${input.login}" is already taken. Try another one, for example "${input.login}.2".` };
    }
    const now = new Date().toISOString();
    const employee: Employee = {
      id: randomUUID(), name: input.name, login: input.login, role: input.role, department: input.department,
      passwordHash: hashPassword(input.password), active: true, lastSignInAt: null, createdAt: now, updatedAt: now,
    };
    all.push(employee);
    await writeAll(all);
    return { ok: true as const, employee };
  });
}

export async function updateEmployee(id: string, patch: { name?: string; role?: RoleKey; department?: Department | null; active?: boolean; passwordHash?: string }): Promise<Employee | null> {
  return withLock(async () => {
    const all = await readAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await writeAll(all);
    return updated;
  });
}

export async function touchLastSignIn(id: string): Promise<void> {
  await withLock(async () => {
    const all = await readAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], lastSignInAt: new Date().toISOString() };
    await writeAll(all);
  });
}

/** For demo reset: employees are real accounts, NOT demo data — never cleared by Reset. */
export async function countEmployees(): Promise<number> {
  return (await readAll()).length;
}
