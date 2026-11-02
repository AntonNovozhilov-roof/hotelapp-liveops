import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getHotelData } from "./hotel-data";

/**
 * Guest "Talk to a person" conversations (G3 / ANT-62) — THE one place for
 * this data (.data/conversations.json, same local pattern as the rest; M2
 * moves it to the database). Privacy: message text lives here only while a
 * conversation is open and for the owner-set retention days after closing,
 * then it is deleted on the next read/write. It is never used in reports;
 * History records only started / joined by / closed by, without the text.
 */

export type ConversationStatus = "waiting" | "with_human" | "closed";
export interface ConversationMessage {
  id: string;
  sender: "guest" | "assistant" | "staff" | "system";
  name: string | null;
  text: string;
  at: string;
}

export interface Conversation {
  id: string;
  room: string;
  status: ConversationStatus;
  reason: string;
  staffName: string | null;
  staffRole: string | null;
  createdAt: string;
  updatedAt: string;
  joinedAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  endReason: "closed" | "handed_back" | null;
  messages: ConversationMessage[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "conversations.json");

let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

async function retentionDays(): Promise<number> {
  try {
    const days = (await getHotelData()).settings.conversationRetentionDays;
    return [1, 7, 30].includes(days) ? days : 7;
  } catch { return 7; }
}

async function readAll(): Promise<Conversation[]> {
  let all: Conversation[] = [];
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as unknown;
    if (Array.isArray(parsed)) all = parsed.filter((c): c is Conversation => Boolean(c) && typeof c === "object" && typeof (c as Conversation).id === "string" && Array.isArray((c as Conversation).messages));
  } catch { return []; }
  // Privacy prune: closed conversations past their retention are deleted.
  const days = await retentionDays();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const kept = all.filter((c) => c.status !== "closed" || !c.closedAt || new Date(c.closedAt).getTime() >= cutoff);
  if (kept.length !== all.length) await writeAll(kept).catch(() => undefined);
  return kept;
}

async function writeAll(all: Conversation[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  await fs.rename(tmp, DATA_FILE);
}

function msg(sender: ConversationMessage["sender"], text: string, name: string | null = null): ConversationMessage {
  return { id: randomUUID(), sender, name, text: text.slice(0, 2000), at: new Date().toISOString() };
}

export function isOpen(c: Conversation): boolean { return c.status === "waiting" || c.status === "with_human"; }

/** Create the room's open conversation, or return the one already open. */
export async function startConversation(room: string, reason: string, guestText?: string, assistantText?: string): Promise<{ conversation: Conversation; created: boolean }> {
  return withLock(async () => {
    const all = await readAll();
    const existing = all.find((c) => c.room === room && isOpen(c));
    if (existing) return { conversation: existing, created: false };
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: randomUUID(), room, status: "waiting", reason,
      staffName: null, staffRole: null, createdAt: now, updatedAt: now,
      joinedAt: null, closedAt: null, closedBy: null, endReason: null,
      messages: [
        ...(guestText ? [msg("guest", guestText)] : []),
        ...(assistantText ? [msg("assistant", assistantText)] : []),
      ],
    };
    all.push(conversation);
    await writeAll(all);
    return { conversation, created: true };
  });
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const all = await readAll();
  return all.find((c) => c.id === id) ?? null;
}

export async function getOpenConversationForRoom(room: string): Promise<Conversation | null> {
  const all = await readAll();
  return all.find((c) => c.room === room && isOpen(c)) ?? null;
}

/** Open conversations for staff: newest waiting first, then human ones by latest activity. */
export async function listOpenConversations(): Promise<Conversation[]> {
  const all = await readAll();
  return all.filter(isOpen).sort((a, b) => {
    if ((a.status === "waiting") !== (b.status === "waiting")) return a.status === "waiting" ? -1 : 1;
    if (a.status === "waiting") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export async function countWaitingConversations(): Promise<number> {
  const all = await readAll();
  return all.filter((c) => c.status === "waiting").length;
}

async function update(id: string, work: (c: Conversation) => boolean): Promise<Conversation | null> {
  return withLock(async () => {
    const all = await readAll();
    const c = all.find((x) => x.id === id);
    if (!c) return null;
    if (work(c)) { c.updatedAt = new Date().toISOString(); await writeAll(all); }
    return c;
  });
}

export async function appendGuestMessage(id: string, text: string): Promise<Conversation | null> {
  return update(id, (c) => { if (!isOpen(c)) return false; c.messages.push(msg("guest", text)); return true; });
}

export async function joinConversation(id: string, name: string, role: string): Promise<Conversation | null> {
  return update(id, (c) => {
    if (!isOpen(c)) return false;
    if (c.status === "with_human" && c.staffName === name) return false;
    c.status = "with_human"; c.staffName = name; c.staffRole = role; c.joinedAt = new Date().toISOString();
    c.messages.push(msg("system", `${name} from the front desk has joined`));
    return true;
  });
}

export async function appendStaffMessage(id: string, name: string, role: string, text: string): Promise<Conversation | null> {
  return update(id, (c) => {
    if (!isOpen(c)) return false;
    if (c.status === "waiting") {
      c.status = "with_human"; c.staffName = name; c.staffRole = role; c.joinedAt = new Date().toISOString();
      c.messages.push(msg("system", `${name} from the front desk has joined`));
    }
    c.messages.push(msg("staff", text, name));
    return true;
  });
}

async function endConversation(id: string, by: string, endReason: "closed" | "handed_back", systemText: string): Promise<Conversation | null> {
  return update(id, (c) => {
    if (!isOpen(c)) return false;
    c.status = "closed"; c.closedAt = new Date().toISOString(); c.closedBy = by; c.endReason = endReason;
    c.messages.push(msg("system", systemText));
    return true;
  });
}

export async function handBackConversation(id: string, by: string): Promise<Conversation | null> {
  return endConversation(id, by, "handed_back", `${by} handed this chat back to the assistant`);
}

export async function closeConversation(id: string, by: string): Promise<Conversation | null> {
  return endConversation(id, by, "closed", `This conversation was closed by ${by}`);
}

export async function clearConversations(): Promise<void> {
  await withLock(async () => writeAll([]));
}

/** What the guest may see of their own conversation (plus the 3-minute phone rule). */
export function guestConversationView(c: Conversation, receptionPhone: string) {
  const waitingMs = Date.now() - new Date(c.createdAt).getTime();
  const showUrgentPhone = c.status === "waiting" && waitingMs >= 3 * 60 * 1000;
  return {
    id: c.id,
    room: c.room,
    status: c.status,
    humanJoined: c.status === "with_human",
    staffName: c.staffName,
    createdAt: c.createdAt,
    waitingSeconds: Math.max(0, Math.floor(waitingMs / 1000)),
    showUrgentPhone,
    receptionPhone: showUrgentPhone ? receptionPhone : null,
    messages: c.messages,
  };
}
