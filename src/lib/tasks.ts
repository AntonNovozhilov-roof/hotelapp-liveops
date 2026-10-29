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
  title: string;
  priority: Priority;
  confidence: number;
}

export type MessageMode = "MOCK" | "LIVE";

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
      tasks.push({
        department: record.department,
        title: record.title.trim().slice(0, 200),
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
  title: string;
  priority: Priority;
  confidence: number;
}

const MOCK_RULES: MockRule[] = [
  {
    pattern: /leak|dripping|flood|plumb|no (hot )?water|water/i,
    department: "maintenance",
    title: "Fix water leak",
    priority: "high",
    confidence: 0.92,
  },
  {
    pattern: /toilet|shower|sink|tap|bathroom/i,
    department: "maintenance",
    title: "Check bathroom issue",
    priority: "high",
    confidence: 0.85,
  },
  {
    pattern: /air.?condition|\bac\b|heating|light|tv|power|electric|door lock|safe/i,
    department: "maintenance",
    title: "Fix room equipment issue",
    priority: "medium",
    confidence: 0.86,
  },
  {
    pattern: /towel/i,
    department: "housekeeping",
    title: "Bring towels",
    priority: "medium",
    confidence: 0.94,
  },
  {
    pattern: /clean|pillow|blanket|sheet|soap|shampoo|tooth|trash|tissue/i,
    department: "housekeeping",
    title: "Housekeeping request",
    priority: "medium",
    confidence: 0.88,
  },
  {
    pattern: /breakfast|food|coffee|tea|wine|beer|burger|pizza|order|hungry|menu|restaurant/i,
    department: "room_service",
    title: "Room service order",
    priority: "medium",
    confidence: 0.87,
  },
  {
    pattern: /check.?in|check.?out|taxi|bill|invoice|key|wake|reservation|book|late/i,
    department: "front_desk",
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
          title: rule.title,
          priority: rule.priority,
          confidence: rule.confidence,
        }
      : {
          department: "front_desk",
          title: `Guest request: ${clause.slice(0, 80)}`,
          priority: "low",
          confidence: 0.5,
        };
    const key = `${task.department}:${task.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      tasks.push(task);
    }
  }

  return tasks.slice(0, 10);
}
