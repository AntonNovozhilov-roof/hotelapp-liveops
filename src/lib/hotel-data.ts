import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomUUID } from "crypto";

/**
 * Hotel data — rooms, QR tokens, hotel info sheet, settings (R1/G2).
 * THE one place for this data, stored like tasks in a local JSON file
 * (.data/hotel.json) so it can move to a database later by changing
 * only this file (same pattern as src/lib/store.ts for tasks).
 */

export interface Room {
  id: string;
  number: string;
  floor: number;
  /** Random, unguessable QR token. Guest link: /r/<number>?t=<token> */
  token: string;
  /** Booking IDs attach here later (manual bookings are LATER). */
  bookingIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface HotelInfo {
  hotelName: string;
  address: string;
  receptionPhone: string;
  emergencyNumber: string;
  wifiName: string;
  wifiPassword: string;
  checkIn: string;
  checkOut: string;
  breakfastHours: string;
  houseRules: string;
  faqs: FaqItem[];
}

export interface HotelSettings {
  /** Demo mode: /r/204 without ?t= still works. On by default. */
  allowLinksWithoutToken: boolean;
}

export interface HotelData {
  rooms: Room[];
  hotelInfo: HotelInfo;
  settings: HotelSettings;
}

export const DEFAULT_HOTEL_INFO: HotelInfo = {
  hotelName: "HotelApp Demo Hotel",
  address: "1 Demo Street, Demo City",
  receptionPhone: "+1 555 0100",
  emergencyNumber: "112",
  wifiName: "HotelApp-Guest",
  wifiPassword: "welcome123",
  checkIn: "14:00",
  checkOut: "12:00",
  breakfastHours: "07:00–10:30",
  houseRules: "No smoking in rooms. Quiet after 22:00, please.",
  faqs: [],
};

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "hotel.json");

let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function defaults(): HotelData {
  return {
    rooms: [],
    hotelInfo: { ...DEFAULT_HOTEL_INFO, faqs: [] },
    settings: { allowLinksWithoutToken: true },
  };
}

function normalize(raw: unknown): HotelData {
  const d = defaults();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const rooms: Room[] = Array.isArray(r.rooms)
    ? (r.rooms as unknown[]).flatMap((x) => {
        if (!x || typeof x !== "object") return [];
        const room = x as Record<string, unknown>;
        if (typeof room.number !== "string" || typeof room.token !== "string") return [];
        return [{
          id: typeof room.id === "string" ? room.id : randomUUID(),
          number: room.number,
          floor: typeof room.floor === "number" ? room.floor : 1,
          token: room.token,
          bookingIds: Array.isArray(room.bookingIds) ? room.bookingIds.filter((b): b is string => typeof b === "string") : [],
          createdAt: typeof room.createdAt === "string" ? room.createdAt : new Date().toISOString(),
          updatedAt: typeof room.updatedAt === "string" ? room.updatedAt : new Date().toISOString(),
        }];
      })
    : [];
  const infoRaw = (r.hotelInfo ?? {}) as Record<string, unknown>;
  const str = (k: keyof HotelInfo, fallback: string) => (typeof infoRaw[k] === "string" ? (infoRaw[k] as string) : fallback);
  const faqs: FaqItem[] = Array.isArray(infoRaw.faqs)
    ? (infoRaw.faqs as unknown[]).flatMap((x) => {
        if (!x || typeof x !== "object") return [];
        const f = x as Record<string, unknown>;
        if (typeof f.question !== "string" || typeof f.answer !== "string") return [];
        return [{ id: typeof f.id === "string" ? f.id : randomUUID(), question: f.question, answer: f.answer }];
      })
    : [];
  const settingsRaw = (r.settings ?? {}) as Record<string, unknown>;
  return {
    rooms,
    hotelInfo: {
      hotelName: str("hotelName", d.hotelInfo.hotelName),
      address: str("address", d.hotelInfo.address),
      receptionPhone: str("receptionPhone", d.hotelInfo.receptionPhone),
      emergencyNumber: str("emergencyNumber", d.hotelInfo.emergencyNumber),
      wifiName: str("wifiName", d.hotelInfo.wifiName),
      wifiPassword: str("wifiPassword", d.hotelInfo.wifiPassword),
      checkIn: str("checkIn", d.hotelInfo.checkIn),
      checkOut: str("checkOut", d.hotelInfo.checkOut),
      breakfastHours: str("breakfastHours", d.hotelInfo.breakfastHours),
      houseRules: str("houseRules", d.hotelInfo.houseRules),
      faqs,
    },
    settings: { allowLinksWithoutToken: settingsRaw.allowLinksWithoutToken !== false },
  };
}

async function readAll(): Promise<HotelData> {
  try {
    return normalize(JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as unknown);
  } catch {
    return defaults();
  }
}

async function writeAll(data: HotelData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmp, DATA_FILE);
}

export async function getHotelData(): Promise<HotelData> {
  return readAll();
}

export async function getRoomByNumber(number: string): Promise<{ room: Room | null; data: HotelData }> {
  const data = await readAll();
  return { room: data.rooms.find((r) => r.number === number) ?? null, data };
}

/** Guest link check: token matches, or room unknown/demo mode allows no token. */
export function guestLinkAllowed(room: Room | null, token: string | null, settings: HotelSettings, hasAnyRooms: boolean): boolean {
  if (!room) return settings.allowLinksWithoutToken || !hasAnyRooms;
  if (token) return token === room.token;
  return settings.allowLinksWithoutToken;
}

export function cleanRoomNumber(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 20) : "";
}
export function validRoomNumber(v: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,19}$/.test(v);
}

export async function addRoomsBulk(floor: number, from: number, to: number): Promise<{ added: Room[]; skipped: string[] }> {
  return withLock(async () => {
    const data = await readAll();
    const existing = new Set(data.rooms.map((r) => r.number));
    const added: Room[] = []; const skipped: string[] = [];
    const now = new Date().toISOString();
    for (let n = from; n <= to; n++) {
      const number = String(n);
      if (existing.has(number)) { skipped.push(number); continue; }
      const room: Room = { id: randomUUID(), number, floor, token: newToken(), bookingIds: [], createdAt: now, updatedAt: now };
      data.rooms.push(room); added.push(room); existing.add(number);
    }
    data.rooms.sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
    await writeAll(data);
    return { added, skipped };
  });
}

export async function addSingleRoom(number: string, floor: number): Promise<{ ok: true; room: Room } | { ok: false; error: string }> {
  return withLock(async () => {
    const data = await readAll();
    if (data.rooms.some((r) => r.number === number)) return { ok: false as const, error: `Room ${number} already exists.` };
    const now = new Date().toISOString();
    const room: Room = { id: randomUUID(), number, floor, token: newToken(), bookingIds: [], createdAt: now, updatedAt: now };
    data.rooms.push(room);
    data.rooms.sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
    await writeAll(data);
    return { ok: true as const, room };
  });
}

export async function updateRoom(id: string, patch: { number?: string; floor?: number }): Promise<{ ok: true; room: Room } | { ok: false; error: string }> {
  return withLock(async () => {
    const data = await readAll();
    const room = data.rooms.find((r) => r.id === id);
    if (!room) return { ok: false as const, error: "Room not found." };
    if (patch.number && patch.number !== room.number && data.rooms.some((r) => r.number === patch.number)) {
      return { ok: false as const, error: `Room ${patch.number} already exists.` };
    }
    if (patch.number) room.number = patch.number;
    if (typeof patch.floor === "number") room.floor = patch.floor;
    room.updatedAt = new Date().toISOString();
    data.rooms.sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
    await writeAll(data);
    return { ok: true as const, room };
  });
}

export async function deleteRoom(id: string): Promise<boolean> {
  return withLock(async () => {
    const data = await readAll();
    const before = data.rooms.length;
    data.rooms = data.rooms.filter((r) => r.id !== id);
    if (data.rooms.length === before) return false;
    await writeAll(data);
    return true;
  });
}

export async function regenerateRoomToken(id: string): Promise<Room | null> {
  return withLock(async () => {
    const data = await readAll();
    const room = data.rooms.find((r) => r.id === id);
    if (!room) return null;
    room.token = newToken();
    room.updatedAt = new Date().toISOString();
    await writeAll(data);
    return room;
  });
}

export async function saveSettings(settings: HotelSettings): Promise<HotelSettings> {
  return withLock(async () => {
    const data = await readAll();
    data.settings = { allowLinksWithoutToken: Boolean(settings.allowLinksWithoutToken) };
    await writeAll(data);
    return data.settings;
  });
}

export async function saveHotelInfo(info: HotelInfo): Promise<HotelInfo> {
  return withLock(async () => {
    const data = await readAll();
    data.hotelInfo = info;
    await writeAll(data);
    return data.hotelInfo;
  });
}

export function guestLink(room: Room, base = ""): string {
  return `${base}/r/${encodeURIComponent(room.number)}?t=${encodeURIComponent(room.token)}`;
}
