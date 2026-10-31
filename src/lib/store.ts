import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  TASK_STATUSES,
  type StoredTask,
  type Task,
  type TaskPhoto,
  type TaskStatus,
} from "./tasks";
import { MAX_PHOTOS_PER_TASK, deleteAllPhotos } from "./photos";

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

/** Tasks saved before photos/review existed get empty photos and no note. */
function normalizeTask(task: StoredTask): StoredTask {
  const raw = (task as { photos?: unknown }).photos;
  const note = (task as { reviewNote?: unknown }).reviewNote;
  return {
    ...task,
    photos: Array.isArray(raw) ? raw.filter(isTaskPhoto) : [],
    reviewNote: typeof note === "string" && note.trim() ? note : null,
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
      createdAt: now,
      updatedAt: now,
    }));
    const all = await readAll();
    await writeAll([...all, ...created]);
    return created;
  });
}

/** Allowed next statuses. Staff never go straight to `done`: only review -> done (approve). */
const NEXT_STATUSES: Partial<Record<TaskStatus, TaskStatus[]>> = {
  new: ["accepted"],
  accepted: ["in_progress"],
  in_progress: ["review"],
  review: ["done", "in_progress"],
  done: [],
};

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
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    await writeAll(all);
    return { ok: true, task: updated } as const;
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
        | "note_required";
      task?: StoredTask;
    };

/**
 * Move a task one step in the flow.
 * - in_progress -> review ("Send to review"): needs at least 1 photo; clears any old send-back note.
 * - review -> done (approve): clears the note.
 * - review -> in_progress (send back): needs a short supervisor `note`, saved as `reviewNote` for staff.
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
    const allowed = NEXT_STATUSES[current.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      return {
        ok: false,
        reason: "invalid_transition",
        task: current,
      } as const;
    }

    const cleanNote = typeof note === "string" ? note.trim().slice(0, MAX_REVIEW_NOTE_LENGTH) : "";

    if (current.status === "in_progress" && nextStatus === "review") {
      if (current.photos.length < 1) {
        return { ok: false, reason: "photo_required", task: current } as const;
      }
    }
    if (current.status === "review" && nextStatus === "in_progress") {
      if (!cleanNote) {
        return { ok: false, reason: "note_required", task: current } as const;
      }
    }

    const updated: StoredTask = {
      ...current,
      status: nextStatus,
      reviewNote:
        current.status === "review" && nextStatus === "in_progress"
          ? cleanNote
          : null,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    await writeAll(all);
    return { ok: true, task: updated } as const;
  });
}
