import { NextResponse } from "next/server";
import { mockTasks, validateTasks, type Task } from "@/lib/tasks";

const MODEL_BASE_URL = "https://api.meta.ai/v1";
const MODEL_NAME = "muse-spark-1.3";

const SYSTEM_PROMPT = `You route hotel guest requests to hotel teams.
Read the guest message and return ONLY JSON, no markdown, no extra text:
{"tasks":[{"department":"maintenance","title":"Fix leak in the bathroom","priority":"high","confidence":0.95}]}

Rules:
- department must be one of: maintenance, housekeeping, front_desk, room_service
- priority must be one of: high, medium, low
- confidence must be a number from 0 to 1
- title must be a short task title in English for hotel staff
- create one task per separate request in the message. Example: "leak in the bathroom and bring towels" makes 2 tasks.
- if the message is unclear, make one front_desk task with low confidence.`;

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model did not return JSON");
    }
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  }
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

async function tasksFromModel(message: string, room: string): Promise<Task[]> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");

  const response = await fetch(`${MODEL_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Guest in room ${room} wrote:\n\n${message}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Model API returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const text = contentToText(data.choices?.[0]?.message?.content);
  if (!text) throw new Error("Model returned an empty answer");

  const parsed = extractJson(text) as { tasks?: unknown } | unknown[];
  const rawTasks = Array.isArray(parsed) ? parsed : parsed.tasks;
  const tasks = validateTasks(rawTasks);
  if (tasks.length === 0) throw new Error("Model returned no valid tasks");
  return tasks;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const message =
    typeof record.message === "string"
      ? record.message.trim()
      : typeof record.text === "string"
        ? record.text.trim()
        : "";
  const room =
    typeof record.room === "string" && record.room.trim()
      ? record.room.trim().slice(0, 20)
      : "204";

  if (!message) {
    return NextResponse.json(
      { error: "Message is empty. Please write a request." },
      { status: 400 },
    );
  }
  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Message is too long (max 2000 characters)." },
      { status: 400 },
    );
  }

  // No key yet: fake answer so the page still works.
  if (!process.env.MODEL_API_KEY) {
    return NextResponse.json({
      mode: "MOCK",
      room,
      tasks: mockTasks(message),
    });
  }

  try {
    const tasks = await tasksFromModel(message, room);
    return NextResponse.json({ mode: "LIVE", room, model: MODEL_NAME, tasks });
  } catch (error) {
    console.error(
      "Model call failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      {
        error:
          "The AI service did not answer. Please try again in a moment.",
      },
      { status: 502 },
    );
  }
}
