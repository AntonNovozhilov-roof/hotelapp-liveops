import {
  guessTaskType,
  isTaskType,
  type TaskType,
} from "./task-types";

export { TASK_TYPES, TASK_TYPE_LABELS, TASK_TYPE_RULES } from "./task-types";
export type { TaskType } from "./task-types";

export const DEPARTMENTS = [
  "maintenance",
  "housekeeping",
  "front_desk",
  "room_service",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const PRIORITIES = ["high", "medium", "low"] as const;

export type Priority = (typeof PRIORITIES)[number];

export interface Task {
  department: Department;
  /** Task type (request/cleaning/repair) — rules in src/lib/task-types.ts. */
  type: TaskType;
  title: string;
  priority: Priority;
  confidence: number;
}

export type MessageMode = "MOCK" | "LIVE";

export const TASK_STATUSES = [
  "new",
  "accepted",
  "in_progress",
  "review",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: "New",
  accepted: "Accepted",
  in_progress: "In progress",
  review: "In review",
  done: "Done",
};

/** Flows by task type (rules in src/lib/task-types.ts). */
export const FLOW_TEXT =
  "Request: New -> Accepted -> In progress -> Done. Cleaning: New -> Accepted -> In progress -> In review -> Done (approved), or In review -> In progress (sent back with a note). Repair: New -> Accepted -> In progress -> Done (proof photo needed), and a supervisor can reopen a done repair to In progress with a note";

/**
 * One saved photo proof on a task. The photo bytes live in photo storage
 * (local .data/photos for now — see src/lib/photos.ts); only this small
 * record is saved on the task.
 */
export interface TaskPhoto {
  name: string;
  url: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

/** One line of an AI photo check: was this thing seen in the photo? */
export type AiCheckItemStatus = "found" | "not_found" | "unsure";

export interface AiCheckItem {
  /** Short key of the check, e.g. "towels" (see PHOTO_CHECKS in src/lib/photo-check.ts). */
  key: string;
  /** Plain name shown to staff, e.g. "Towels". */
  label: string;
  status: AiCheckItemStatus;
  /** Best SAM confidence 0..1, or null when SAM gave none (or in MOCK mode). */
  confidence: number | null;
  /** How many matching objects SAM found. */
  count: number;
}

/**
 * The saved AI photo check result on a task (SAM 3.1, see
 * src/lib/photo-check.ts). This only helps the supervisor — the AI never
 * approves a task, so there is deliberately no pass/fail verdict here.
 * `score` is 0..100: the share of checks found (an "unsure" check counts half).
 */
export interface TaskAiCheck {
  score: number;
  checks: AiCheckItem[];
  /** Problems in plain words. Empty when every check was found. */
  issues: string[];
  model: string;
  mode: "LIVE" | "MOCK";
  checkedAt: string;
  /** P1 simple verdict (system + simple UI words only). */
  verdict?: "ready" | "different" | "unsure";
  /** P1: true when compared with the room's perfect reference. */
  comparedToReference?: boolean;
  /** P1: pass with high confidence (for the owner auto-approve setting). */
  highConfidence?: boolean;
}

/** A task saved on the server (in .data/tasks.json for now). */
export interface StoredTask extends Task {
  id: string;
  room: string;
  status: TaskStatus;
  photos: TaskPhoto[];
  /** Supervisor note when a task is sent back from review. Null otherwise. */
  reviewNote: string | null;
  /** Last AI photo check, or null when no check ran on the current photos. */
  aiCheck: TaskAiCheck | null;
  /** P1: how many times the AI check failed in this work cycle. */
  aiFailCount: number;
  /** P1: failed the AI check twice — supervisor sees this flag. */
  flaggedTwice: boolean;
  /** M10: clearly labelled demo sample-week data (owner can remove it). */
  sample?: boolean;
  /** E1: real name of the person who accepted this task. */
  acceptedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DEPARTMENT_LABELS: Record<Department, string> = {
  maintenance: "Maintenance",
  housekeeping: "Housekeeping",
  front_desk: "Front desk",
  room_service: "Room service",
};

export interface StaffMember {
  name: string;
  department: Department;
}

export const STAFF: StaffMember[] = [
  { name: "Ruslan", department: "maintenance" },
  { name: "Aigerim", department: "housekeeping" },
  { name: "Daniyar", department: "front_desk" },
  { name: "Madina", department: "room_service" },
];

const PRIORITY_WEIGHT: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Urgent first, then oldest first (first in, first out). Same in every column. */
export function sortTasks(tasks: StoredTask[]): StoredTask[] {
  return [...tasks].sort((a, b) => {
    const byPriority =
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (byPriority !== 0) return byPriority;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Board column order (F1): Done is newest first (most recently finished on
 * top); every other column stays urgent first, then oldest first.
 */
export function sortForColumn(
  tasks: StoredTask[],
  status: TaskStatus,
): StoredTask[] {
  if (status === "done") {
    return [...tasks].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
  return sortTasks(tasks);
}

/** True when the AI check has a "not found" / "not sure" item (or none saved). */
export function aiNeedsAttention(task: StoredTask): boolean {
  if (!task.aiCheck) return true;
  return task.aiCheck.checks.some((check) => check.status !== "found");
}

/**
 * Supervisor review queue order (M7): tasks where the AI said "not found"
 * or "not sure" first, then oldest first (first in, first out).
 */
export function sortReviewTasks(tasks: StoredTask[]): StoredTask[] {
  return [...tasks].sort((a, b) => {
    const byAttention =
      Number(aiNeedsAttention(b)) - Number(aiNeedsAttention(a));
    if (byAttention !== 0) return byAttention;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/** "just now", "5 min ago", "2 h ago", "3 d ago" */
export function timeAgo(isoDate: string, now = new Date()): string {
  const seconds = Math.floor(
    (now.getTime() - new Date(isoDate).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function isDepartment(value: unknown): value is Department {
  return (
    typeof value === "string" &&
    (DEPARTMENTS as readonly string[]).includes(value)
  );
}

function isPriority(value: unknown): value is Priority {
  return (
    typeof value === "string" && (PRIORITIES as readonly string[]).includes(value)
  );
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

/** Keep only tasks that match the required shape. */
export function validateTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  const tasks: Task[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const confidence = clampConfidence(record.confidence);
    if (
      isDepartment(record.department) &&
      isPriority(record.priority) &&
      typeof record.title === "string" &&
      record.title.trim().length > 0 &&
      confidence !== null
    ) {
      const title = record.title.trim().slice(0, 200);
      tasks.push({
        department: record.department,
        // AI type wins; no/invalid type -> guess from the title.
        type: isTaskType(record.type)
          ? record.type
          : guessTaskType(title),
        title,
        priority: record.priority,
        confidence,
      });
    }
  }
  return tasks.slice(0, 10);
}

interface MockRule {
  pattern: RegExp;
  department: Department;
  type: TaskType;
  title: string;
  priority: Priority;
  confidence: number;
}

const MOCK_RULES: MockRule[] = [
  {
    pattern: /leak|dripping|flood|plumb|no (hot )?water|протек|потоп|теч[её]т/i,
    department: "maintenance",
    type: "repair",
    title: "Fix water leak",
    priority: "high",
    confidence: 0.92,
  },
  {
    pattern: /toilet|shower|sink|tap|bathroom/i,
    department: "maintenance",
    type: "repair",
    title: "Check bathroom issue",
    priority: "high",
    confidence: 0.85,
  },
  {
    pattern: /air.?condition|\bac\b|heating|light|tv|power|electric|door lock|safe|broken/i,
    department: "maintenance",
    type: "repair",
    title: "Fix room equipment issue",
    priority: "medium",
    confidence: 0.86,
  },
  {
    pattern: /\bclean(ing)?\b/i,
    department: "housekeeping",
    type: "cleaning",
    title: "Clean the room",
    priority: "medium",
    confidence: 0.9,
  },
  {
    pattern: /towel|полотен/i,
    department: "housekeeping",
    type: "request",
    title: "Bring towels",
    priority: "medium",
    confidence: 0.94,
  },
  {
    pattern: /pillow|blanket|sheet|soap|shampoo|tooth|trash|tissue|water|подушк|одеял|мыло|шампун/i,
    department: "housekeeping",
    type: "request",
    title: "Housekeeping request",
    priority: "medium",
    confidence: 0.88,
  },
  {
    pattern: /breakfast|food|coffee|tea|wine|beer|burger|pizza|order|hungry|menu|restaurant/i,
    department: "room_service",
    type: "request",
    title: "Room service order",
    priority: "medium",
    confidence: 0.87,
  },
  {
    pattern: /check.?in|check.?out|taxi|bill|invoice|key|wake|reservation|book|late/i,
    department: "front_desk",
    type: "request",
    title: "Front desk request",
    priority: "medium",
    confidence: 0.84,
  },
];

/**
 * Simple fake routing used when no MODEL_API_KEY is set.
 * Splits a message on "and" / commas so one message can make several tasks.
 */
export function mockTasks(message: string): Task[] {
  const clauses = message
    .split(/\band\b|,|;|\+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const tasks: Task[] = [];
  const seen = new Set<string>();

  for (const clause of clauses.length ? clauses : [message]) {
    const rule = MOCK_RULES.find((candidate) => candidate.pattern.test(clause));
    const task: Task = rule
      ? {
          department: rule.department,
          type: rule.type,
          title: rule.title,
          priority: rule.priority,
          confidence: rule.confidence,
        }
      : {
          department: "front_desk",
          type: "request",
          title: `Guest request: ${clause.slice(0, 80)}`,
          priority: "low",
          confidence: 0.5,
        };
    const key = `${task.department}:${task.type}:${task.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      tasks.push(task);
    }
  }

  return tasks.slice(0, 10);
}
