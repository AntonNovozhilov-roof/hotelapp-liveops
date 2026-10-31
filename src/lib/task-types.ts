/**
 * Task types and photo rules — T1 / ANT-39.
 *
 * THE one place for the type rules. To change what a type needs
 * (photo, AI check, review), change TASK_TYPE_RULES here only;
 * the store, APIs and staff board all read from this table.
 *
 * - request: bring/deliver, info, taxi, food. Accept -> Start -> Done.
 * - cleaning: clean a room. Accept -> Start -> photo -> AI check -> review.
 * - repair: fix something. Accept -> Start -> proof photo -> Done
 *   (no AI check; supervisor can reopen a done repair with a note).
 */

export const TASK_TYPES = ["request", "cleaning", "repair"] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export interface TaskTypeRule {
  label: string;
  /** Staff must add at least 1 photo before the final step. */
  photoRequired: boolean;
  /** AI photo check must have run before the final step. */
  aiCheckRequired: boolean;
  /** Final step sends the task to a supervisor instead of finishing it. */
  goesToReview: boolean;
}

export const TASK_TYPE_RULES: Record<TaskType, TaskTypeRule> = {
  request: {
    label: "Request",
    photoRequired: false,
    aiCheckRequired: false,
    goesToReview: false,
  },
  cleaning: {
    label: "Cleaning",
    photoRequired: true,
    aiCheckRequired: true,
    goesToReview: true,
  },
  repair: {
    label: "Repair",
    photoRequired: true,
    aiCheckRequired: false,
    goesToReview: false,
  },
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  request: TASK_TYPE_RULES.request.label,
  cleaning: TASK_TYPE_RULES.cleaning.label,
  repair: TASK_TYPE_RULES.repair.label,
};

export function isTaskType(value: unknown): value is TaskType {
  return (
    typeof value === "string" &&
    (TASK_TYPES as readonly string[]).includes(value)
  );
}

const CLEANING_PATTERN = /\bclean(ing|ed)?\b|housekeeping clean/i;

const REPAIR_PATTERN =
  /leak|dripping|flood|plumb|broken|fix|repair|clog|not working|doesn'?t work|no (hot )?water|air.?condition|\bac\b|heating|heater|light bulb|power|electric|door lock|safe|toilet|shower|sink|tap|bathroom/i;

/**
 * Guess a type from a title. Used for old saved tasks without a type
 * and when the AI does not send one. Default is "request".
 */
export function guessTaskType(title: string): TaskType {
  if (CLEANING_PATTERN.test(title)) return "cleaning";
  if (REPAIR_PATTERN.test(title)) return "repair";
  return "request";
}

/** Valid type wins; otherwise guess from the title. */
export function resolveTaskType(
  type: unknown,
  title: string,
): TaskType {
  return isTaskType(type) ? type : guessTaskType(title);
}
