import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomUUID } from "crypto";

/**
 * Hotel data — rooms, QR tokens, hotel info sheet, settings (R1/G2).
 * THE one place for this data, stored like tasks in a local JSON file
 * (.data/hotel.json) so it can move to a database later by changing
 * only this file (same pattern as src/lib/store.ts for tasks).
 */

export const REFERENCE_LABELS = ["Bed area", "Bathroom", "Other"] as const;
export type ReferenceLabel = (typeof REFERENCE_LABELS)[number];

export interface ReferencePhoto {
  name: string;
  url: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  label: ReferenceLabel;
}

/** One cached SAM item result on a reference (system-only, never shown). */
export interface ReferenceItem {
  key: string;
  label: string;
  status: "found" | "not_found" | "unsure";
  confidence: number | null;
  count: number;
}

/**
 * A perfect-room reference set (P1): 1–3 photos plus the cached AI result
 * for them. The cached items are NOT re-run unless the photos change.
 */
export interface ReferenceRecord {
  id: string;
  photos: ReferencePhoto[];
  items: ReferenceItem[];
  itemSource: "vision" | "broad" | "mock";
  checkedAt: string | null;
  uploadedBy: string;
  uploadedByRole: string;
  uploadedAt: string;
  reason: string | null;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  /** Random, unguessable QR token. Guest link: /r/<number>?t=<token> */
  token: string;
  /** Booking IDs attach here later (manual bookings are LATER). */
  bookingIds: string[];
  /** Active perfect-room reference, or null (P1). */
  reference: ReferenceRecord | null;
  /** Uploaded but not yet approved reference, or null (P1). */
  pendingReference: ReferenceRecord | null;
  /** Archived references, newest first (P1). Never deleted. */
  referenceHistory: ReferenceRecord[];
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
  /** P1: auto-approve cleaning when the AI is sure. Off by default. */
  autoApproveCleaning: boolean;
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
    settings: { allowLinksWithoutToken: true, autoApproveCleaning: false },
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
          reference: normalizeReference(room.reference),
          pendingReference: normalizeReference(room.pendingReference),
          referenceHistory: Array.isArray(room.referenceHistory) ? room.referenceHistory.flatMap((h) => { const n = normalizeReference(h); return n ? [n] : []; }) : [],
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
    settings: { allowLinksWithoutToken: settingsRaw.allowLinksWithoutToken !== false, autoApproveCleaning: settingsRaw.autoApproveCleaning === true },
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

/**
 * Guest link check (SEC1): a QR token always works when it matches.
 * A link WITHOUT a token is allowed only in DEMO_MODE (server env), never
 * just because a setting or an empty room list says so.
 */
export function guestLinkAllowed(room: Room | null, token: string | null, _settings?: HotelSettings, _hasAnyRooms?: boolean): boolean {
  if (room && token) return token === room.token;
  if (token) return false;
  return process.env.DEMO_MODE === "true";
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
      const room: Room = { id: randomUUID(), number, floor, token: newToken(), bookingIds: [], reference: null, pendingReference: null, referenceHistory: [], createdAt: now, updatedAt: now };
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
    const room: Room = { id: randomUUID(), number, floor, token: newToken(), bookingIds: [], reference: null, pendingReference: null, referenceHistory: [], createdAt: now, updatedAt: now };
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

export async function saveSettings(settings: Partial<HotelSettings>): Promise<HotelSettings> {
  return withLock(async () => {
    const data = await readAll();
    data.settings = {
      allowLinksWithoutToken: settings.allowLinksWithoutToken !== undefined ? Boolean(settings.allowLinksWithoutToken) : data.settings.allowLinksWithoutToken,
      autoApproveCleaning: settings.autoApproveCleaning !== undefined ? Boolean(settings.autoApproveCleaning) : data.settings.autoApproveCleaning,
    };
    await writeAll(data);
    return data.settings;
  });
}

function normalizeReference(raw: unknown): ReferenceRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const photos: ReferencePhoto[] = Array.isArray(r.photos) ? (r.photos as unknown[]).flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const ph = x as Record<string, unknown>;
    if (typeof ph.name !== "string" || typeof ph.url !== "string") return [];
    return [{ name: ph.name, url: ph.url, contentType: typeof ph.contentType === "string" ? ph.contentType : "image/jpeg", size: typeof ph.size === "number" ? ph.size : 0, uploadedAt: typeof ph.uploadedAt === "string" ? ph.uploadedAt : new Date().toISOString(), label: (REFERENCE_LABELS as readonly string[]).includes(ph.label as string) ? (ph.label as ReferenceLabel) : "Other" }];
  }) : [];
  if (photos.length === 0) return null;
  const items: ReferenceItem[] = Array.isArray(r.items) ? (r.items as unknown[]).flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const it = x as Record<string, unknown>;
    if (typeof it.key !== "string") return [];
    return [{ key: it.key, label: typeof it.label === "string" ? it.label : it.key, status: it.status === "found" || it.status === "not_found" ? it.status : "unsure", confidence: typeof it.confidence === "number" ? it.confidence : null, count: typeof it.count === "number" ? it.count : 0 }];
  }) : [];
  return {
    id: typeof r.id === "string" ? r.id : randomUUID(),
    photos, items,
    itemSource: r.itemSource === "vision" || r.itemSource === "broad" ? r.itemSource : "mock",
    checkedAt: typeof r.checkedAt === "string" ? r.checkedAt : null,
    uploadedBy: typeof r.uploadedBy === "string" ? r.uploadedBy : "Unknown",
    uploadedByRole: typeof r.uploadedByRole === "string" ? r.uploadedByRole : "",
    uploadedAt: typeof r.uploadedAt === "string" ? r.uploadedAt : new Date().toISOString(),
    reason: typeof r.reason === "string" && r.reason.trim() ? r.reason : null,
  };
}

export async function setPendingReference(roomId: string, rec: ReferenceRecord): Promise<Room | null> {
  return withLock(async () => {
    const data = await readAll();
    const room = data.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    room.pendingReference = rec; room.updatedAt = new Date().toISOString();
    await writeAll(data); return room;
  });
}

export async function approvePendingReference(roomId: string, reason: string | null): Promise<{ room: Room; archived: ReferenceRecord | null } | null> {
  return withLock(async () => {
    const data = await readAll();
    const room = data.rooms.find((r) => r.id === roomId);
    if (!room || !room.pendingReference) return null;
    const archived = room.reference;
    if (archived) room.referenceHistory = [archived, ...room.referenceHistory];
    room.reference = { ...room.pendingReference, reason };
    room.pendingReference = null; room.updatedAt = new Date().toISOString();
    await writeAll(data); return { room, archived };
  });
}

export async function clearPendingReference(roomId: string): Promise<Room | null> {
  return withLock(async () => {
    const data = await readAll();
    const room = data.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    room.pendingReference = null; room.updatedAt = new Date().toISOString();
    await writeAll(data); return room;
  });
}

/** Reset rooms, hotel info and settings to a fresh start (Owner Reset). */
export async function clearHotelData(): Promise<void> {
  await withLock(async () => writeAll(defaults()));
}

/** Guest-safe hotel info (SEC1): what a guest with a valid room link may see. */
export interface GuestHotelInfo {
  hotelName: string;
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

export function guestSafeHotelInfo(info: HotelInfo): GuestHotelInfo {
  return {
    hotelName: info.hotelName,
    receptionPhone: info.receptionPhone,
    emergencyNumber: info.emergencyNumber,
    wifiName: info.wifiName,
    wifiPassword: info.wifiPassword,
    checkIn: info.checkIn,
    checkOut: info.checkOut,
    breakfastHours: info.breakfastHours,
    houseRules: info.houseRules,
    faqs: info.faqs,
  };
}

export async function saveHotelInfo(info: HotelInfo): Promise<HotelInfo> {
  return withLock(async () => {
    const data = await readAll();
    data.hotelInfo = info;
    await writeAll(data);
    return data.hotelInfo;
  });
}

/** Room shape for screens/APIs: reference item details stay system-only. */
export function publicRoom(room: Room): Omit<Room, "reference" | "pendingReference" | "referenceHistory"> & {
  reference: Omit<ReferenceRecord, "items"> | null;
  pendingReference: Omit<ReferenceRecord, "items"> | null;
  referenceHistory: Omit<ReferenceRecord, "items">[];
} {
  const strip = (r: ReferenceRecord | null) => (r ? { ...r, items: undefined, checked: Boolean(r.checkedAt) } : null);
  return {
    ...room,
    reference: strip(room.reference) as never,
    pendingReference: strip(room.pendingReference) as never,
    referenceHistory: room.referenceHistory.map((r) => strip(r)) as never,
  } as never;
}

export function guestLink(room: Room, base = ""): string {
  return `${base}/r/${encodeURIComponent(room.number)}?t=${encodeURIComponent(room.token)}`;
}
