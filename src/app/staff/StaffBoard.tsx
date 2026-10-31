"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Check, Sparkles, TriangleAlert } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import {
  STATUS_LABELS,
  TASK_STATUSES,
  TASK_TYPE_LABELS,
  TASK_TYPE_RULES,
  sortTasks,
  timeAgo,
  type StoredTask,
  type TaskPhoto,
  type TaskStatus,
  type TaskType,
} from "@/lib/tasks";

import type { PublicUser } from "@/lib/users";

const POLL_MS = 3000;

const PRIORITY_TONES: Record<StoredTask["priority"], string> = {
  high: "dirty",
  medium: "occ",
  low: "neutral",
};

const PRIORITY_LABELS: Record<StoredTask["priority"], string> = {
  high: "Urgent",
  medium: "Soon",
  low: "When possible",
};

const TYPE_TONES: Record<TaskType, string> = {
  request: "brand",
  cleaning: "clean",
  repair: "dirty",
};

/** Next button by task type (rules in src/lib/task-types.ts). */
function nextActionFor(
  task: StoredTask,
): { label: string; next: TaskStatus } | null {
  if (task.status === "new") return { label: "Accept", next: "accepted" };
  if (task.status === "accepted")
    return { label: "Start", next: "in_progress" };
  if (task.status === "in_progress") {
    return TASK_TYPE_RULES[task.type].goesToReview
      ? { label: "Send to review", next: "review" }
      : { label: "Done", next: "done" };
  }
  return null;
}

/** Why the final button is blocked, in plain words (null = not blocked). */
function finishHint(task: StoredTask): string | null {
  if (task.status !== "in_progress") return null;
  const rule = TASK_TYPE_RULES[task.type];
  if (!rule.photoRequired) return "No photo needed. Press Done when finished.";
  if (task.photos.length === 0) {
    return task.type === "repair"
      ? "Add a proof photo to finish. No AI check needed."
      : "Add at least 1 photo, then run the AI photo check.";
  }
  if (rule.aiCheckRequired && !task.aiCheck) {
    return "Run the AI photo check to send to review.";
  }
  return task.type === "repair"
    ? "Proof photo added. Press Done when finished."
    : "AI check done. You can send to review.";
}

/** The final button stays disabled until the type rules are met. */
function finishBlocked(task: StoredTask): boolean {
  if (task.status !== "in_progress") return false;
  const rule = TASK_TYPE_RULES[task.type];
  if (rule.photoRequired && task.photos.length === 0) return true;
  if (rule.aiCheckRequired && !task.aiCheck) return true;
  return false;
}

export default function StaffBoard({ user }: { user: PublicUser }) {
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [, setNowTick] = useState(0);

  // The signed-in person decides the team: no picker, no other teams.
  const department = user.department;

  const loadTasks = useCallback(async () => {
    try {
      // One fetch for everything: the board needs this team's tasks,
      // and the "Who are you?" badges need NEW counts for every team.
      const response = await fetch("/api/tasks", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load tasks");
      const data = (await response.json()) as { tasks: StoredTask[] };
      setTasks(
        sortTasks(data.tasks.filter((task) => task.department === department)),
      );
      setError(null);
    } catch {
      setError("Could not load tasks. The page will keep trying.");
    }
  }, [department]);

  useEffect(() => {
    void loadTasks();
    const timer = setInterval(() => {
      void loadTasks();
      setNowTick((tick) => tick + 1);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadTasks]);

  async function uploadPhoto(task: StoredTask, file: File) {
    if (photoBusyId) return;
    setPhotoBusyId(task.id);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const response = await fetch(`/api/tasks/${task.id}/photos`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save the photo.");
      }
      await loadTasks();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not save the photo.",
      );
    } finally {
      setPhotoBusyId(null);
    }
  }

  async function deleteTaskPhoto(task: StoredTask, photo: TaskPhoto) {
    if (photoBusyId) return;
    setPhotoBusyId(task.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/tasks/${task.id}/photos?name=${encodeURIComponent(photo.name)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete the photo.");
      }
      await loadTasks();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the photo.",
      );
    } finally {
      setPhotoBusyId(null);
    }
  }

  async function runAiCheck(task: StoredTask) {
    if (aiBusyId) return;
    setAiBusyId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/ai-check`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not run the AI photo check.");
      }
      await loadTasks();
    } catch (checkError) {
      setError(
        checkError instanceof Error
          ? checkError.message
          : "Could not run the AI photo check.",
      );
    } finally {
      setAiBusyId(null);
    }
  }

  async function moveTask(task: StoredTask) {
    const action = nextActionFor(task);
    if (!action || busyId) return;
    setBusyId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action.next }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not update the task.");
      }
      await loadTasks();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update the task.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const openTasks = tasks.filter((task) => task.status !== "done");
  const newTaskCount = tasks.filter((task) => task.status === "new").length;
  const nextTask = openTasks.find((task) => task.status !== "review");

  return (
    <div>
      <Card className="bg-brand-950 p-4 text-white sm:p-5">
        <p className="text-[12.5px] text-brand-100/70">Today · {user.roleLabel}</p>
        <p className="mt-1 font-display text-[19px] font-semibold leading-tight">
          {openTasks.length > 0
            ? `${openTasks.length} task${openTasks.length > 1 ? "s" : ""} to go`
            : "All done, great work"}
        </p>
        <p className="mt-0.5 text-[13px] text-brand-100/80">
          {newTaskCount > 0
            ? `${newTaskCount} new. `
            : ""}
          {nextTask
            ? `Next: Room ${nextTask.room} — ${nextTask.title}`
            : "New tasks appear automatically."}
        </p>
      </Card>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep"
        >
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status);
          const isReview = status === "review";
          return (
            <section
              key={status}
              className={`rounded-xl2 border p-3 sm:p-3.5 ${
                isReview
                  ? "border-insp/40 bg-insp-soft ring-2 ring-insp/20"
                  : "border-line bg-line-2/70"
              }`}
              aria-label={STATUS_LABELS[status]}
            >
              <h3 className="flex items-center justify-between px-1 text-[14px] font-semibold">
                {STATUS_LABELS[status]}
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[12.5px] font-semibold tabular-nums ring-1 ring-line">
                  {columnTasks.length}
                </span>
              </h3>
              {isReview && (
                <p className="mt-1 px-1 text-[12.5px] font-semibold text-insp-deep">
                  Waiting for supervisor
                </p>
              )}

              {columnTasks.length === 0 ? (
                <p className="mt-3 rounded-xl bg-white/70 p-3 text-[13px] text-ink-4">
                  No tasks
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {columnTasks.map((task) => {
                    const action = nextActionFor(task);
                    const hint = finishHint(task);
                    const rule = TASK_TYPE_RULES[task.type];
                    return (
                      <li key={task.id}>
                        <Card className="p-4">
                        <p className="font-display text-[13px] font-semibold text-brand-700">
                          Room {task.room}
                        </p>
                        <p className="mt-1 text-[14.5px] font-semibold leading-snug">
                          {task.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                          <Badge tone={TYPE_TONES[task.type]} dot>
                            {TASK_TYPE_LABELS[task.type]}
                          </Badge>
                          <Badge tone={PRIORITY_TONES[task.priority]} dot>
                            {PRIORITY_LABELS[task.priority]}
                          </Badge>
                          <span>{timeAgo(task.createdAt)}</span>
                        </div>
                        {task.status === "review" && (
                          <p className="mt-3 rounded-xl bg-insp-soft px-3 py-2 text-[13px] font-semibold text-insp-deep">
                            In review — waiting for supervisor
                          </p>
                        )}
                        {task.reviewNote && task.status !== "review" && (
                          <div
                            role="note"
                            className="mt-3 rounded-xl bg-occ-soft px-3 py-2 text-[13px] text-occ-deep"
                          >
                            <span className="font-semibold">
                              {task.type === "repair"
                                ? "Reopened by supervisor:"
                                : "Sent back by supervisor:"}
                            </span>{" "}
                            {task.reviewNote}
                          </div>
                        )}
                        {rule.photoRequired &&
                          (task.status === "in_progress" ||
                            task.photos.length > 0) && (
                          <div className="mt-3 border-t border-line-2 pt-3">
                            <p className="text-[13px] font-semibold text-ink-2">
                              {task.type === "repair"
                                ? "Proof photo"
                                : "Photos"}{" "}
                              ({task.photos.length}/3)
                            </p>
                            {task.photos.length > 0 && (
                              <ul className="mt-2 grid grid-cols-3 gap-2">
                                {task.photos.map((photo) => (
                                  <li key={photo.name} className="relative">
                                    <a
                                      href={photo.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      aria-label="Open photo full size"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={photo.url}
                                        alt="Task photo"
                                        className="aspect-square w-full rounded-xl border border-line object-cover"
                                      />
                                    </a>
                                    {task.status === "in_progress" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void deleteTaskPhoto(task, photo)
                                        }
                                        disabled={photoBusyId === task.id}
                                        aria-label="Delete photo"
                                        className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-sm font-bold text-white shadow-pop disabled:opacity-50"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {task.status === "in_progress" &&
                              (task.photos.length < 3 ? (
                                <label
                                  className={`mt-2 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-brand-500 hover:bg-brand-50 ${
                                    photoBusyId === task.id
                                      ? "pointer-events-none opacity-50"
                                      : ""
                                  }`}
                                >
                                  <Camera className="size-4 text-brand-700" />
                                  {photoBusyId === task.id
                                    ? "Saving photo..."
                                    : "Add photo"}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      event.target.value = "";
                                      if (file) void uploadPhoto(task, file);
                                    }}
                                  />
                                </label>
                              ) : (
                                <p className="mt-2 text-[12.5px] text-ink-4">
                                  Max 3 photos. Delete one to add another.
                                </p>
                              ))}
                          </div>
                        )}
                        {rule.aiCheckRequired &&
                          (task.photos.length > 0 || task.aiCheck) && (
                          <div className="mt-3 border-t border-line-2 pt-3">
                            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                              <Sparkles className="size-4 text-brand-600" />
                              AI photo check
                            </p>
                            {task.aiCheck ? (
                              <div className="mt-2 rounded-xl bg-canvas px-3 py-2.5 text-[13px] text-ink-2">
                                <p className="flex flex-wrap items-center gap-2">
                                  <span className="font-display text-[20px] font-semibold text-ink">
                                    {task.aiCheck.score}
                                  </span>
                                  <span className="text-ink-3">/ 100</span>
                                  {task.aiCheck.mode === "MOCK" && (
                                    <Badge tone="occ">MOCK</Badge>
                                  )}
                                </p>
                                <p className="mt-0.5 text-[11.5px] text-ink-4">
                                  Model: {task.aiCheck.model}. This check
                                  only helps the supervisor — it never
                                  approves the task.
                                </p>
                                <ul className="mt-2 space-y-1">
                                  {task.aiCheck.checks.map((check) => (
                                    <li key={check.key}>
                                      {check.label}:{" "}
                                      <span className="font-semibold text-ink">
                                        {check.status === "found"
                                          ? "Found"
                                          : check.status === "not_found"
                                            ? "Not found"
                                            : "Not sure"}
                                      </span>
                                      {check.confidence !== null &&
                                        ` (${Math.round(check.confidence * 100)}% sure)`}
                                    </li>
                                  ))}
                                </ul>
                                {task.aiCheck.issues.length > 0 ? (
                                  <div className="mt-2.5 rounded-xl bg-dirty-soft px-3 py-2.5 text-dirty-deep">
                                    <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                                      <TriangleAlert className="size-4" />
                                      AI noticed:
                                    </p>
                                    <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px]">
                                      {task.aiCheck.issues.map((issue) => (
                                        <li key={issue}>{issue}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-ready-soft px-3 py-2.5 text-[13px] font-semibold text-ready-deep">
                                    <Check className="size-4" />
                                    No problems found in the photo.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-1 text-[12.5px] text-ink-4">
                                Not checked yet.
                              </p>
                            )}
                            {(task.status === "in_progress" ||
                              task.status === "review") &&
                              task.photos.length > 0 && (
                                <Button
                                  variant="secondary"
                                  loading={aiBusyId === task.id}
                                  icon={
                                    aiBusyId === task.id ? undefined : (
                                      <Sparkles className="size-4 text-brand-700" />
                                    )
                                  }
                                  onClick={() => void runAiCheck(task)}
                                  className="mt-2 w-full"
                                >
                                  {aiBusyId === task.id
                                    ? "Checking photo..."
                                    : task.aiCheck
                                      ? "Run AI photo check again"
                                      : "Run AI photo check"}
                                </Button>
                              )}
                          </div>
                        )}
                        {action ? (
                          <>
                            <Button
                              size="lg"
                              loading={busyId === task.id}
                              onClick={() => void moveTask(task)}
                              disabled={finishBlocked(task)}
                              className="mt-3 w-full"
                            >
                              {busyId === task.id ? "Saving..." : action.label}
                            </Button>
                            {hint && (
                              <p className="mt-2 text-[12.5px] text-ink-4">
                                {hint}
                              </p>
                            )}
                          </>
                        ) : task.status === "review" ? (
                          <p className="mt-3 text-[13px] font-semibold text-insp-deep">
                            Waiting for supervisor
                          </p>
                        ) : (
                          <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-ready-deep">
                            <Check className="size-4" /> Done
                          </p>
                        )}
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

    </div>
  );
}
