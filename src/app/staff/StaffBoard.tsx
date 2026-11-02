"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Check, Sparkles, TriangleAlert } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_STATUSES,
  TASK_TYPE_LABELS,
  TASK_TYPE_RULES,
  effectiveRule,
  sortForColumn,
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

function failedOnce(task: StoredTask): boolean {
  return Boolean(
    task.type === "cleaning" &&
      task.status === "in_progress" &&
      task.aiCheck?.verdict === "different" &&
      (task.aiFailCount ?? 0) >= 1,
  );
}

type CleaningSettingsState = { aiPhotoCheckEnabled: boolean; cleanerPhotoRequired: boolean };

/** Why the final button is blocked, in plain words (null = not blocked). */
function finishHint(task: StoredTask, settings: CleaningSettingsState): string | null {
  if (task.status !== "in_progress") return null;
  const rule = effectiveRule(task.type, settings);
  const aiOn = settings.aiPhotoCheckEnabled;
  if (!rule.photoRequired && task.type !== "cleaning") return "No photo needed. Press Done when finished.";
  if (!rule.photoRequired && task.type === "cleaning") {
    if (task.photos.length === 0) return aiOn ? "No photo is required. You can add photos and run the AI check, or send straight to review." : "No photo is required. Press Send to review when finished.";
    if (aiOn && !task.aiCheck) return "Run the AI photo check to send to review, because you added photos.";
    return "You can send to review.";
  }
  if (task.photos.length === 0) {
    return task.type === "repair"
      ? "Add a proof photo to finish. No AI check needed."
      : aiOn ? "Add at least 1 photo, then run the AI photo check." : "Add at least 1 photo, then send to review.";
  }
  if (rule.aiCheckRequired && !task.aiCheck) {
    return "Run the AI photo check to send to review.";
  }
  if (failedOnce(task)) {
    return "Check the room and take new photos.";
  }
  if (task.aiCheck?.mode === "MOCK") {
    return AI_CHECK_FAILED_MESSAGE;
  }
  return task.type === "repair"
    ? "Proof photo added. Press Done when finished."
    : aiOn ? "AI check done. You can send to review." : "Photo added. You can send to review.";
}

/** The final button stays disabled until the type rules are met. */
function finishBlocked(task: StoredTask, settings: CleaningSettingsState): boolean {
  if (task.status !== "in_progress") return false;
  const rule = effectiveRule(task.type, settings);
  if (rule.photoRequired && task.photos.length === 0) return true;
  if (rule.aiCheckRequired && !task.aiCheck && (rule.photoRequired || task.photos.length > 0)) return true;
  // P1: after a failed AI check the only way forward is Retake photos.
  if (settings.aiPhotoCheckEnabled && failedOnce(task)) return true;
  return false;
}

export const AI_CHECK_FAILED_MESSAGE =
  "The AI couldn't check this photo right now. Try again.";

/** Simple AI words for the cleaner (P1) — never item names or counts. */
function cleanerVerdict(task: StoredTask): { text: string; good: boolean } | null {
  const check = task.aiCheck;
  if (!check) return null;
  if (task.status === "done")
    return { text: "Done ✓ — approved by a supervisor or finished automatically.", good: true };
  // PC1: a MOCK result never looks like success.
  if (check.mode === "MOCK") return { text: AI_CHECK_FAILED_MESSAGE, good: false };
  if (check.verdict === "ready") return { text: "✓ Looks ready", good: true };
  if (check.verdict === "different") {
    return {
      text: check.comparedToReference
        ? "Not ready yet. The room looks different from the perfect photo. Check the room and take new photos."
        : "Not ready yet. Something in the photo does not look right. Check the room and take new photos.",
      good: false,
    };
  }
  return { text: "AI not sure. A supervisor will look at the photos.", good: false };
}

export default function StaffBoard({ user }: { user: PublicUser }) {
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [aiFailedIds, setAiFailedIds] = useState<Record<string, boolean>>({});
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number; seconds: number } | null>(null);
  const [, setNowTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cleaningSettings, setCleaningSettings] = useState<CleaningSettingsState>({ aiPhotoCheckEnabled: true, cleanerPhotoRequired: true });
  const [perfectAreas, setPerfectAreas] = useState<Record<string, string[]>>({});

  // The signed-in person decides the team: no picker, no other teams.
  const department = user.department;

  const loadTasks = useCallback(async () => {
    try {
      // One fetch for everything: the board needs this team's tasks,
      // and the "Who are you?" badges need NEW counts for every team.
      const response = await fetch("/api/tasks", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load tasks");
      const data = (await response.json()) as { tasks: StoredTask[]; settings?: CleaningSettingsState; perfectAreas?: Record<string, string[]> };
      if (data.settings) setCleaningSettings(data.settings);
      if (data.perfectAreas) setPerfectAreas(data.perfectAreas);
      setTasks(
        sortTasks(data.tasks.filter((task) => task.department === department)),
      );
      setError(null);
    } catch {
      setError("Could not load tasks. Check your connection — the page will keep trying on its own.");
    } finally {
      setLoading(false);
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

  /** Retake (cleaning only, M6): clear all photos + the AI result at once. */
  async function retakePhotos(task: StoredTask) {
    if (photoBusyId) return;
    if (
      !window.confirm(
        "Retake photos? This clears all photos and the AI result for this task.",
      )
    ) {
      return;
    }
    setPhotoBusyId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/photos`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not clear the photos.");
      }
      await loadTasks();
    } catch (retakeError) {
      setError(
        retakeError instanceof Error
          ? retakeError.message
          : "Could not clear the photos.",
      );
    } finally {
      setPhotoBusyId(null);
    }
  }

  // PC1 part 3: while a check runs, poll its progress and count seconds
  // so the screen never looks frozen.
  useEffect(() => {
    if (!aiBusyId) {
      setAiProgress(null);
      return;
    }
    const startedAt = Date.now();
    setAiProgress({ done: 0, total: 0, seconds: 0 });
    const timer = setInterval(() => {
      setAiProgress((current) => ({
        done: current?.done ?? 0,
        total: current?.total ?? 0,
        seconds: Math.round((Date.now() - startedAt) / 1000),
      }));
      void (async () => {
        try {
          const res = await fetch(`/api/tasks/${aiBusyId}/ai-check/progress`, { cache: "no-store" });
          if (!res.ok) return;
          const data = (await res.json()) as { progress: { done: number; total: number } | null };
          const progress = data.progress;
          if (progress) {
            setAiProgress((current) => ({
              done: progress.done,
              total: progress.total,
              seconds: current?.seconds ?? 0,
            }));
          }
        } catch {
          // Progress is best-effort; the elapsed timer still runs.
        }
      })();
    }, 700);
    return () => clearInterval(timer);
  }, [aiBusyId]);

  async function runAiCheck(task: StoredTask) {
    if (aiBusyId) return;
    setAiBusyId(task.id);
    setError(null);
    setAiFailedIds((current) => ({ ...current, [task.id]: false }));
    try {
      const response = await fetch(`/api/tasks/${task.id}/ai-check`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || AI_CHECK_FAILED_MESSAGE);
      }
      await loadTasks();
    } catch {
      // PC1: a failed check shows the Try-again message on the task itself.
      setAiFailedIds((current) => ({ ...current, [task.id]: true }));
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
          const columnTasks = sortForColumn(
            tasks.filter((task) => task.status === status),
            status,
          );
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
              <p className="mt-1 px-1 text-[12px] text-ink-4">
                {status === "done"
                  ? "Newest first"
                  : "Urgent first, then oldest"}
              </p>
              {isReview && (
                <p className="mt-1 px-1 text-[12.5px] font-semibold text-insp-deep">
                  Waiting for supervisor
                </p>
              )}

              {loading && columnTasks.length === 0 ? (
                <div className="mt-3 space-y-2" role="status" aria-label="Loading your tasks">
                  <div className="h-24 animate-pulse rounded-xl bg-white/80" />
                  <div className="h-24 animate-pulse rounded-xl bg-white/60" />
                  <span className="sr-only">Loading your tasks…</span>
                </div>
              ) : columnTasks.length === 0 ? (
                <p className="mt-3 rounded-xl bg-white/70 p-3 text-[13px] text-ink-4">
                  {status === "new" ? "No new tasks — you're all caught up. New guest requests appear here." : status === "done" ? "Nothing finished yet. Finished work lands here." : `No tasks ${STATUS_LABELS[status].toLowerCase()} right now.`}
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {columnTasks.map((task) => {
                    const action = nextActionFor(task);
                    const hint = finishHint(task, cleaningSettings);
                    const rule = effectiveRule(task.type, cleaningSettings);
                    const aiOn = cleaningSettings.aiPhotoCheckEnabled;
                    const photoAreas = task.type === "cleaning" && aiOn ? (perfectAreas[task.room] ?? []) : [];
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
                          {task.sample && <Badge tone="brass">Sample</Badge>}
                          <span>{timeAgo(task.createdAt)}</span>
                          {task.acceptedBy && task.status !== "new" && <span className="font-semibold text-ink-2">Accepted by {task.acceptedBy}</span>}
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
                        {(rule.photoRequired || task.type === "cleaning") &&
                          (task.status === "in_progress" ||
                            task.photos.length > 0) && (
                          <div className="mt-3 border-t border-line-2 pt-3">
                            <p className="text-[13px] font-semibold text-ink-2">
                              {task.type === "repair"
                                ? "Proof photo"
                                : "Photos"}{" "}
                              ({task.photos.length}/3)
                            </p>
                            {photoAreas.length > 0 && task.status === "in_progress" && (
                              <p className="mt-1.5 rounded-xl bg-brand-50 px-3 py-2 text-[12.5px] font-semibold text-brand-800">Take photos of: {photoAreas.join(", ")}</p>
                            )}
                            {task.type === "cleaning" && !rule.photoRequired && task.status === "in_progress" && (
                              <p className="mt-1 text-[12.5px] text-ink-4">A photo is not required for this cleaning.</p>
                            )}
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
                                        className="absolute -top-2 -right-2 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-lg font-bold text-white shadow-pop disabled:opacity-50 sm:h-8 sm:w-8"
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
                                  className={`mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-brand-500 hover:bg-brand-50 sm:h-10 ${
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
                        {aiOn && rule.aiCheckRequired &&
                          (task.photos.length > 0 || task.aiCheck) && (
                          <div className="mt-3 border-t border-line-2 pt-3">
                            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                              <Sparkles className="size-4 text-brand-600" />
                              AI photo check
                            </p>
                            {aiFailedIds[task.id] && (
                              <p className="mt-2 rounded-xl bg-occ-soft px-3 py-2.5 text-[13.5px] font-semibold text-occ-deep">
                                {AI_CHECK_FAILED_MESSAGE}
                              </p>
                            )}
                            {task.aiCheck ? (
                              <div className="mt-2">
                                {(() => {
                                  const v = cleanerVerdict(task);
                                  return v ? (
                                    <p className={`rounded-xl px-3 py-2.5 text-[13.5px] font-semibold ${v.good ? "bg-ready-soft text-ready-deep" : task.aiCheck.verdict === "different" ? "bg-dirty-soft text-dirty-deep" : "bg-occ-soft text-occ-deep"}`}>
                                      {v.text}
                                      {task.aiCheck.mode === "MOCK" && <span className="ml-2"><Badge tone="occ">MOCK</Badge></span>}
                                    </p>
                                  ) : null;
                                })()}
                                {task.aiCheck.hint && task.aiCheck.verdict === "different" && (
                                  <p className="mt-2 text-[12.5px] font-semibold text-ink-2">
                                    {task.aiCheck.hint}
                                  </p>
                                )}
                                {task.aiCheck.comparedToReference === false && (
                                  <p className="mt-2 text-[12.5px] text-ink-4">
                                    No perfect photo for room {task.room} yet. Ask the owner to add one.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-1 text-[12.5px] text-ink-4">
                                Not checked yet.
                              </p>
                            )}
                            {!failedOnce(task) &&
                              (task.status === "in_progress" ||
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
                                    : aiFailedIds[task.id] || task.aiCheck?.mode === "MOCK"
                                      ? "Try again"
                                      : task.aiCheck
                                        ? "Run AI photo check again"
                                        : "Run AI photo check"}
                                </Button>
                              )}
                            {aiBusyId === task.id && (
                              <p className="mt-2 text-[12.5px] font-semibold text-ink-3" role="status">
                                {aiProgress && aiProgress.total > 0
                                  ? `Checking photo… ${aiProgress.done} of ${aiProgress.total} items · ${aiProgress.seconds}s`
                                  : `Checking photo… ${aiProgress?.seconds ?? 0}s`}
                              </p>
                            )}
                            {task.type === "cleaning" &&
                              task.status === "in_progress" &&
                              task.photos.length > 0 && (
                                <Button
                                  variant="danger"
                                  loading={photoBusyId === task.id}
                                  onClick={() => void retakePhotos(task)}
                                  className="mt-2 w-full"
                                >
                                  {photoBusyId === task.id
                                    ? "Clearing photos..."
                                    : "Retake photos"}
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
                              disabled={finishBlocked(task, cleaningSettings)}
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
