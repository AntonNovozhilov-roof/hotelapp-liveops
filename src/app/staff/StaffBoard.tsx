"use client";

import { useCallback, useEffect, useState } from "react";
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

const PRIORITY_STYLES: Record<StoredTask["priority"], string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
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
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold">Who are you?</h2>
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
                className={`relative rounded-xl border px-4 py-3 text-left font-semibold ${
                  isActive
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:border-teal-600"
                }`}
              >
                {person.name}
                <span
                  className={`block text-sm font-normal ${
                    isActive ? "text-teal-50" : "text-slate-500"
                  }`}
                >
                  {DEPARTMENT_LABELS[person.department]}
                </span>
                {newCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white shadow">
                    {newCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Showing only {DEPARTMENT_LABELS[member.department]} tasks for{" "}
          {member.name}. New tasks appear automatically.
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
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
              className={`rounded-3xl p-3 sm:p-4 ${
                isReview
                  ? "bg-amber-100 ring-2 ring-amber-400"
                  : "bg-slate-200/60"
              }`}
              aria-label={STATUS_LABELS[status]}
            >
              <h3 className="flex items-center justify-between px-1 font-bold">
                {STATUS_LABELS[status]}
                <span className="rounded-full bg-white px-2.5 py-0.5 text-sm">
                  {columnTasks.length}
                </span>
              </h3>
              {isReview && (
                <p className="mt-1 px-1 text-sm font-semibold text-amber-900">
                  Waiting for supervisor
                </p>
              )}

              {columnTasks.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-white/70 p-3 text-sm text-slate-500">
                  No tasks
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {columnTasks.map((task) => {
                    const action = NEXT_ACTION[task.status];
                    return (
                      <li
                        key={task.id}
                        className="rounded-2xl bg-white p-4 shadow-sm"
                      >
                        <p className="text-sm font-bold text-teal-800">
                          Room {task.room}
                        </p>
                        <p className="mt-1 font-semibold">{task.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${PRIORITY_STYLES[task.priority]}`}
                          >
                            {task.priority}
                          </span>
                          <span>{timeAgo(task.createdAt)}</span>
                        </div>
                        {task.status === "review" && (
                          <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">
                            In review — waiting for supervisor
                          </p>
                        )}
                        {task.reviewNote && task.status !== "review" && (
                          <div
                            role="note"
                            className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                          >
                            <span className="font-bold">
                              Sent back by supervisor:
                            </span>{" "}
                            {task.reviewNote}
                          </div>
                        )}
                        {(task.status === "in_progress" ||
                          task.photos.length > 0) && (
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <p className="text-sm font-semibold text-slate-700">
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
                                        className="aspect-square w-full rounded-lg object-cover"
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
                                        className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white shadow disabled:opacity-50"
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
                                  className={`mt-2 block w-full cursor-pointer rounded-xl border border-teal-700 px-4 py-2.5 text-center font-semibold text-teal-800 hover:bg-teal-50 ${
                                    photoBusyId === task.id
                                      ? "pointer-events-none opacity-50"
                                      : ""
                                  }`}
                                >
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
                                <p className="mt-2 text-sm text-slate-500">
                                  Max 3 photos. Delete one to add another.
                                </p>
                              ))}
                          </div>
                        )}
                        {action ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void moveTask(task)}
                              disabled={
                                busyId === task.id ||
                                (task.status === "in_progress" &&
                                  task.photos.length === 0)
                              }
                              className="mt-3 w-full rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busyId === task.id ? "Saving..." : action.label}
                            </button>
                            {task.status === "in_progress" &&
                              task.photos.length === 0 && (
                                <p className="mt-2 text-sm text-slate-500">
                                  Add at least 1 photo to send to review.
                                </p>
                              )}
                          </>
                        ) : task.status === "review" ? (
                          <p className="mt-3 text-sm font-semibold text-amber-800">
                            Waiting for supervisor
                          </p>
                        ) : (
                          <p className="mt-3 text-sm font-semibold text-emerald-700">
                            Done ✓
                          </p>
                        )}
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
          className="text-sm text-slate-500 underline underline-offset-4 hover:text-red-700"
        >
          Reset demo data
        </button>
      </footer>
    </div>
  );
}
