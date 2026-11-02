import { NextResponse } from "next/server";
import { validateTasks, type Task } from "@/lib/tasks";
import { createStoredTasks } from "@/lib/store";
import { getHotelData } from "@/lib/hotel-data";
import { appendHistory } from "@/lib/history";
import { applyGuardrails, buildSystemPrompt, mockAssistant, type ChatMessage } from "@/lib/guest-ai";
import { GUEST_COOKIE, createGuestToken, guestCookieOptions, guestDataFromToken, type GuestTokenData } from "@/lib/security";
import type { StoredTask } from "@/lib/tasks";

function existingGuest(request: Request): GuestTokenData | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === GUEST_COOKIE) return guestDataFromToken(decodeURIComponent(rest.join("=")));
  }
  return null;
}

/** Guest responses carry only id/title/status, plus the signed guest cookie. */
function guestResponse(request: Request, room: string, saved: StoredTask[], body: Record<string, unknown>): NextResponse {
  const response = NextResponse.json({
    ...body,
    room,
    tasks: saved.map((t) => ({ id: t.id, title: t.title, status: t.status })),
  });
  if (saved.length) {
    const previous = existingGuest(request);
    const ids = [...(previous && previous.room === room ? previous.taskIds : []), ...saved.map((t) => t.id)];
    response.cookies.set(GUEST_COOKIE, createGuestToken(room, ids), guestCookieOptions());
  }
  return response;
}

const MODEL_BASE_URL = "https://api.meta.ai/v1";
const MODEL_NAME = "muse-spark-1.3";

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned) as unknown; } catch {
    const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("Model did not return JSON");
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  }
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => {
    if (part && typeof part === "object" && "text" in part) {
      const t = (part as { text?: unknown }).text;
      return typeof t === "string" ? t : "";
    }
    return "";
  }).join("");
  return "";
}

function cleanHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    const role = r.role === "assistant" ? "assistant" as const : r.role === "guest" || r.role === "user" ? "guest" as const : null;
    const content = typeof r.content === "string" ? r.content.trim().slice(0, 500) : "";
    return role && content ? [{ role, content }] : [];
  }).slice(-6);
}

async function assistantFromModel(message: string, room: string, history: ChatMessage[], hotelInfo: Parameters<typeof buildSystemPrompt>[0]): Promise<{ reply: string; tasks: Task[] }> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");
  const response = await fetch(`${MODEL_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL_NAME,
      temperature: 0.2,
      messages: [
        { role: "system", content: buildSystemPrompt(hotelInfo, room) },
        ...history.map((m) => ({ role: m.role === "guest" ? "user" : "assistant", content: m.content })),
        { role: "user", content: `Guest in room ${room} wrote:\n\n${message}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Model API returned HTTP ${response.status}`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const text = contentToText(data.choices?.[0]?.message?.content);
  if (!text) throw new Error("Model returned an empty answer");
  const parsed = extractJson(text) as { reply?: unknown; tasks?: unknown };
  const reply = typeof parsed.reply === "string" ? parsed.reply.trim().slice(0, 1000) : "";
  const tasks = validateTasks(parsed.tasks);
  if (!reply && tasks.length === 0) throw new Error("Model returned no valid answer");
  return { reply, tasks };
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const record = (body ?? {}) as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message.trim() : typeof record.text === "string" ? record.text.trim() : "";
  const room = typeof record.room === "string" && record.room.trim() ? record.room.trim().slice(0, 20) : "204";
  const history = cleanHistory(record.history ?? record.messages);

  if (!message) return NextResponse.json({ error: "Message is empty. Please write a request." }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Message is too long (max 2000 characters)." }, { status: 400 });

  const { hotelInfo } = await getHotelData();

  if (!process.env.MODEL_API_KEY) {
    const result = mockAssistant(message, hotelInfo, room);
    const saved = result.tasks.length ? await createStoredTasks(room, result.tasks) : [];
    for (const t of saved) await appendHistory({ actorName: "Guest", actorRole: "Guest", room: t.room, taskId: t.id, taskTitle: t.title, taskType: t.type, action: "Task created", details: `Guest asked via the room page (AI): ${t.title}` });
    return guestResponse(request, room, saved, { mode: "MOCK", reply: result.reply });
  }

  try {
    const raw = await assistantFromModel(message, room, history, hotelInfo);
    const result = applyGuardrails(message, hotelInfo, room, raw);
    const saved = result.tasks.length ? await createStoredTasks(room, result.tasks) : [];
    for (const t of saved) await appendHistory({ actorName: "Guest", actorRole: "Guest", room: t.room, taskId: t.id, taskTitle: t.title, taskType: t.type, action: "Task created", details: `Guest asked via the room page (AI): ${t.title}` });
    return guestResponse(request, room, saved, { mode: "LIVE", model: MODEL_NAME, reply: result.reply });
  } catch (error) {
    console.error("Model call failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "The AI service did not answer. Please try again in a moment." }, { status: 502 });
  }
}
