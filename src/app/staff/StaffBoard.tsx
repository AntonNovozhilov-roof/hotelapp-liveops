"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Check, Sparkles, TriangleAlert } from "lucide-react";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import {
  DEPARTMENT_LABELS,
  STAFF,
  STATUS_LABELS,
  TASK_STATUSES,
  sortTasks,
  timeAgo,
  type Department,
  type StoredTask,
  type TaskPhoto,
  type TaskStatus,
} from "@/lib/tasks";

const POLL_MS = 3000;
const STORAGE_KEY = "hotelapp-staff-name";

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

const NEXT_ACTION: Partial<
  Record<TaskStatus, { label: string; next: TaskStatus }>
> = {
  new: { label: "Accept", next: "accepted" },
  accepted: { label: "Start", next: "in_progress" },
  in_progress: { label: "Send to review", next: "review" },
};

export default function StaffBoard() {
  const [staffName, setStaffName] = useState(STAFF[0].name);
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [newCounts, setNewCounts] = useState<Record<Department, number>>({
    maintenance: 0,
    housekeeping: 0,
    front_desk: 0,
    room_service: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [, setNowTick] = useState(0);

  const member = STAFF.find((person) => person.name === staffName) ?? STAFF[0];

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && STAFF.some((person) => person.name === saved)) {
      setStaffName(saved);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      // One fetch for everything: the board needs this team's tasks,
      // and the "Who are you?" badges need NEW counts for every team.
      const response = await fetch("/api/tasks", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load tasks");
      const data = (await response.json()) as { tasks: StoredTask[] };
      setTasks(
        sortTasks(
          data.tasks.filter((task) => task.department === member.department),
        ),
      );
      setNewCounts({
        maintenance: data.tasks.filter(
          (task) => task.department === "maintenance" && task.status === "new",
        ).length,
        housekeeping: data.tasks.filter(
          (task) =>
            task.department === "housekeeping" && task.status === "new",
        ).length,
        front_desk: data.tasks.filter(
          (task) => task.department === "front_desk" && task.status === "new",
        ).length,
        room_service: data.tasks.filter(
          (task) =>
            task.department === "room_service" && task.status === "new",
        ).length,
      });
      setError(null);
    } catch {
      setError("Could not load tasks. The page will keep trying.");
    }
  }, [member.department]);

  useEffect(() => {
    void loadTasks();
    const timer = setInterval(() => {
      void loadTasks();
      setNowTick((tick) => tick + 1);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadTasks]);

  function chooseStaff(name: string) {
    setStaffName(name);
    window.localStorage.setItem(STORAGE_KEY, name);
  }

  async function resetDemoData() {
    const confirmed = window.confirm(
      "Are you sure? This will delete ALL saved tasks for every room and team.",
    );
    if (!confirmed) return;
    setError(null);
    try {
      const response = await fetch("/api/tasks", { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not clear the tasks.");
      }
      setTasks([]);
      setNewCounts({
        maintenance: 0,
        housekeeping: 0,
        front_desk: 0,
        room_service: 0,
      });
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Could not clear the tasks.",
      );
    }
  }

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
    const action = NEXT_ACTION[task.status];
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

  return (
    <div>
      <Card className="p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold">Who are you?</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {STAFF.map((person) => {
            const isActive = person.name === staffName;
            const newCount = newCounts[person.department];
            return (
              <button
                key={person.name}
                type="button"
                onClick={() => chooseStaff(person.name)}
                aria-pressed={isActive}
                aria-label={
                  newCount > 0
                    ? `${person.name}, ${DEPARTMENT_LABELS[person.department]}, ${newCount} new tasks`
                    : `${person.name}, ${DEPARTMENT_LABELS[person.department]}`
                }
                className={`relative flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                  isActive
                    ? "border-brand-700 bg-brand-700 text-white shadow-card"
                    : "border-line bg-white text-ink hover:border-brand-500"
                }`}
              >
                <Avatar name={person.name} role={person.department} size={34} />
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-tight">
                    {person.name}
                  </span>
                  <span
                    className={`block text-[12.5px] ${
                      isActive ? "text-brand-100/80" : "text-ink-3"
                    }`}
                  >
                    {DEPARTMENT_LABELS[person.department]}
                  </span>
                </span>
                {newCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-dirty px-1.5 text-xs font-bold text-white shadow-pop">
                    {newCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] text-ink-3">
          Showing only {DEPARTMENT_LABELS[member.department]} tasks for{" "}
          {member.name}. New tasks appear automatically.
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
                    const action = NEXT_ACTION[task.status];
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
                              Sent back by supervisor:
                            </span>{" "}
                            {task.reviewNote}
                          </div>
                        )}
                        {(task.status === "in_progress" ||
                          task.photos.length > 0) && (
                          <div className="mt-3 border-t border-line-2 pt-3">
                            <p className="text-[13px] font-semibold text-ink-2">
                              Photos ({task.photos.length}/3)
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
                        {(task.photos.length > 0 || task.aiCheck) && (
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
                              disabled={
                                task.status === "in_progress" &&
                                task.photos.length === 0
                              }
                              className="mt-3 w-full"
                            >
                              {busyId === task.id ? "Saving..." : action.label}
                            </Button>
                            {task.status === "in_progress" &&
                              task.photos.length === 0 && (
                                <p className="mt-2 text-[12.5px] text-ink-4">
                                  Add at least 1 photo to send to review.
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

      <footer className="mt-10 text-center">
        <button
          type="button"
          onClick={() => void resetDemoData()}
          className="text-[13px] text-ink-4 underline underline-offset-4 hover:text-dirty-deep"
        >
          Reset demo data
        </button>
      </footer>
    </div>
  );
}
