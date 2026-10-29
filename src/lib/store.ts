import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  TASK_STATUSES,
  type StoredTask,
  type Task,
  type TaskStatus,
} from "./tasks";

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

async function readAll(): Promise<StoredTask[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredTask);
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
    return tasks.length;
  });
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
      createdAt: now,
      updatedAt: now,
    }));
    const all = await readAll();
    await writeAll([...all, ...created]);
    return created;
  });
}

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  new: "accepted",
  accepted: "in_progress",
  in_progress: "done",
};

export type UpdateResult =
  | { ok: true; task: StoredTask }
  | { ok: false; reason: "not_found" | "invalid_transition"; task?: StoredTask };

export async function updateStoredTaskStatus(
  id: string,
  nextStatus: TaskStatus,
): Promise<UpdateResult> {
  return withLock(async () => {
    const all = await readAll();
    const index = all.findIndex((task) => task.id === id);
    if (index === -1) return { ok: false, reason: "not_found" } as const;

    const current = all[index];
    if (NEXT_STATUS[current.status] !== nextStatus) {
      return {
        ok: false,
        reason: "invalid_transition",
        task: current,
      } as const;
    }

    const updated: StoredTask = {
      ...current,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    await writeAll(all);
    return { ok: true, task: updated } as const;
  });
}
