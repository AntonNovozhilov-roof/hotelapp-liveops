import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  TASK_STATUSES,
  type AiCheckItem,
  type StoredTask,
  type Task,
  type TaskAiCheck,
  type TaskPhoto,
  type TaskStatus,
} from "./tasks";
import { MAX_PHOTOS_PER_TASK, deleteAllPhotos } from "./photos";
import { TASK_TYPE_RULES, resolveTaskType } from "./task-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "tasks.json");

// Serialize read-modify-write cycles so parallel requests cannot lose tasks.
let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isStoredTask(value: unknown): value is StoredTask {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.room === "string" &&
    typeof record.title === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    TASK_STATUSES.includes(record.status as TaskStatus)
  );
}

function isTaskPhoto(value: unknown): value is TaskPhoto {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    typeof record.url === "string" &&
    typeof record.contentType === "string" &&
    typeof record.size === "number" &&
    typeof record.uploadedAt === "string"
  );
}

function isAiCheckItem(value: unknown): value is AiCheckItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.key === "string" &&
    typeof record.label === "string" &&
    (record.status === "found" ||
      record.status === "not_found" ||
      record.status === "unsure") &&
    (record.confidence === null || typeof record.confidence === "number") &&
    typeof record.count === "number"
  );
}

function isTaskAiCheck(value: unknown): value is TaskAiCheck {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.score === "number" &&
    Array.isArray(record.checks) &&
    record.checks.every(isAiCheckItem) &&
    Array.isArray(record.issues) &&
    record.issues.every((issue) => typeof issue === "string") &&
    typeof record.model === "string" &&
    (record.mode === "LIVE" || record.mode === "MOCK") &&
    typeof record.checkedAt === "string"
  );
}

/**
 * Old saved tasks get defaults: no photos/note/check, and a type guessed
 * from the title (otherwise "request") — see src/lib/task-types.ts.
 */
function normalizeTask(task: StoredTask): StoredTask {
  const raw = (task as { photos?: unknown }).photos;
  const note = (task as { reviewNote?: unknown }).reviewNote;
  const check = (task as { aiCheck?: unknown }).aiCheck;
  return {
    ...task,
    type: resolveTaskType((task as { type?: unknown }).type, task.title),
    photos: Array.isArray(raw) ? raw.filter(isTaskPhoto) : [],
    reviewNote: typeof note === "string" && note.trim() ? note : null,
    aiCheck: isTaskAiCheck(check) ? check : null,
  };
}

async function readAll(): Promise<StoredTask[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredTask).map(normalizeTask);
  } catch {
    // No file yet (or unreadable): start with an empty list.
    return [];
  }
}

async function writeAll(tasks: StoredTask[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

export async function listStoredTasks(filter?: {
  room?: string;
  department?: string;
  ids?: string[];
}): Promise<StoredTask[]> {
  const tasks = await readAll();
  return tasks.filter((task) => {
    if (filter?.ids && !filter.ids.includes(task.id)) return false;
    if (filter?.room && task.room !== filter.room) return false;
    if (filter?.department && task.department !== filter.department)
      return false;
    return true;
  });
}

/** Delete every saved task (staff "Reset demo data"). Returns how many were removed. */
export async function clearStoredTasks(): Promise<number> {
  return withLock(async () => {
    const tasks = await readAll();
    await writeAll([]);
    await deleteAllPhotos();
    return tasks.length;
  });
}

export async function getStoredTask(id: string): Promise<StoredTask | null> {
  const tasks = await readAll();
  return tasks.find((task) => task.id === id) ?? null;
}

export async function createStoredTasks(
  room: string,
  tasks: Task[],
): Promise<StoredTask[]> {
  return withLock(async () => {
    const now = new Date().toISOString();
    const created: StoredTask[] = tasks.map((task) => ({
      ...task,
      id: randomUUID(),
      room,
      status: "new",
      photos: [],
      reviewNote: null,
      aiCheck: null,
      createdAt: now,
      updatedAt: now,
    }));
    const all = await readAll();
    await writeAll([...all, ...created]);
    return created;
  });
}

/** A "Clean room <number>" cleaning task (supervisor/owner form, T1). */
export async function createCleaningTask(
  room: string,
): Promise<StoredTask> {
  const [task] = await createStoredTasks(room, [
    {
      department: "housekeeping",
      type: "cleaning",
      title: `Clean room ${room}`,
      priority: "medium",
      confidence: 1,
    },
  ]);
  return task;
}

/**
 * Allowed next statuses, by task type (rules in src/lib/task-types.ts):
 * request/repair finish from in_progress; cleaning goes to review first.
 * A done repair can be reopened by a supervisor (role checked in the API).
 */
function nextStatuses(task: StoredTask): TaskStatus[] {
  const rule = TASK_TYPE_RULES[task.type];
  switch (task.status) {
    case "new":
      return ["accepted"];
    case "accepted":
      return ["in_progress"];
    case "in_progress":
      return [rule.goesToReview ? "review" : "done"];
    case "review":
      return ["done", "in_progress"];
    case "done":
      return task.type === "repair" ? ["in_progress"] : [];
  }
}

export const MAX_REVIEW_NOTE_LENGTH = 500;

export type PhotoUpdateResult =
  | { ok: true; task: StoredTask }
  | {
      ok: false;
      reason: "not_found" | "not_started" | "limit_reached" | "photo_not_found";
      task?: StoredTask;
    };

/** Attach one saved photo to a started (in_progress) task. Max 3 photos. */
export async function addStoredTaskPhoto(
  id: string,
  photo: TaskPhoto,
): Promise<PhotoUpdateResult> {
  return withLock(async () => {
    const all = await readAll();
    const index = all.findIndex((task) => task.id === id);
    if (index === -1) return { ok: false, reason: "not_found" } as const;

    const current = all[index];
    if (current.status !== "in_progress") {
      return { ok: false, reason: "not_started", task: current } as const;
    }
    if (current.photos.length >= MAX_PHOTOS_PER_TASK) {
      return { ok: false, reason: "limit_reached", task: current } as const;
    }

    const updated: StoredTask = {
      ...current,
      photos: [...current.photos, photo],
      // The photo set changed: any old AI check no longer matches it.
      aiCheck: null,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    await writeAll(all);
    return { ok: true, task: updated } as const;
  });
}

/** Save the AI photo check result on a task. Returns null for an unknown id. */
export async function saveStoredTaskAiCheck(
  id: string,
  aiCheck: TaskAiCheck,
): Promise<StoredTask | null> {
  return withLock(async () => {
    const all = await readAll();
    const index = all.findIndex((task) => task.id === id);
    if (index === -1) return null;
    const updated: StoredTask = {
      ...all[index],
      aiCheck,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    await writeAll(all);
    return updated;
  });
}

/** Remove one photo record from a task. The caller deletes the file. */
export async function removeStoredTaskPhoto(
  id: string,
  photoName: string,
): Promise<PhotoUpdateResult> {
  return withLock(async () => {
    const all = await readAll();
    const index = all.findIndex((task) => task.id === id);
    if (index === -1) return { ok: false, reason: "not_found" } as const;

    const current = all[index];
    if (!current.photos.some((photo) => photo.name === photoName)) {
      return { ok: false, reason: "photo_not_found", task: current } as const;
    }

    const updated: StoredTask = {
      ...current,
      photos: current.photos.filter((photo) => photo.name !== photoName),
      // The photo set changed: any old AI check no longer matches it.
      aiCheck: null,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    await writeAll(all);
    return { ok: true, task: updated } as const;
  });
}

export type UpdateResult =
  | { ok: true; task: StoredTask }
  | {
      ok: false;
      reason:
        | "not_found"
        | "invalid_transition"
        | "photo_required"
        | "ai_check_required"
        | "note_required";
      task?: StoredTask;
    };

/**
 * Move a task one step in its type flow (TASK_TYPE_RULES):
 * - cleaning in_progress -> review: needs a photo AND an AI check.
 * - repair in_progress -> done: needs a proof photo (no AI check).
 * - request in_progress -> done: no photo needed.
 * - review -> in_progress (send back) and done repair -> in_progress
 *   (reopen): need a short supervisor `note`, saved as `reviewNote`.
 */
export async function updateStoredTaskStatus(
  id: string,
  nextStatus: TaskStatus,
  note?: string,
): Promise<UpdateResult> {
  return withLock(async () => {
    const all = await readAll();
    const index = all.findIndex((task) => task.id === id);
    if (index === -1) return { ok: false, reason: "not_found" } as const;

    const current = all[index];
    if (!nextStatuses(current).includes(nextStatus)) {
      return {
        ok: false,
        reason: "invalid_transition",
        task: current,
      } as const;
    }

    const cleanNote = typeof note === "string" ? note.trim().slice(0, MAX_REVIEW_NOTE_LENGTH) : "";
    const rule = TASK_TYPE_RULES[current.type];
    const isFinalStep =
      current.status === "in_progress" &&
      nextStatus === (rule.goesToReview ? "review" : "done");

    if (isFinalStep && rule.photoRequired && current.photos.length < 1) {
      return { ok: false, reason: "photo_required", task: current } as const;
    }
    if (isFinalStep && rule.aiCheckRequired && !current.aiCheck) {
      return {
        ok: false,
        reason: "ai_check_required",
        task: current,
      } as const;
    }
    const needsNote =
      (current.status === "review" && nextStatus === "in_progress") ||
      (current.status === "done" && nextStatus === "in_progress");
    if (needsNote && !cleanNote) {
      return { ok: false, reason: "note_required", task: current } as const;
    }

    const updated: StoredTask = {
      ...current,
      status: nextStatus,
      reviewNote: needsNote ? cleanNote : null,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    await writeAll(all);
    return { ok: true, task: updated } as const;
  });
}
