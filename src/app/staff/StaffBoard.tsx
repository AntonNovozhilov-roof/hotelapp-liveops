"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEPARTMENT_LABELS,
  STAFF,
  STATUS_LABELS,
  TASK_STATUSES,
  sortTasks,
  timeAgo,
  type StoredTask,
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
  in_progress: { label: "Done", next: "done" },
};

export default function StaffBoard() {
  const [staffName, setStaffName] = useState(STAFF[0].name);
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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
      const response = await fetch(
        `/api/tasks?department=${encodeURIComponent(member.department)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Could not load tasks");
      const data = (await response.json()) as { tasks: StoredTask[] };
      setTasks(sortTasks(data.tasks));
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
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Could not clear the tasks.",
      );
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
            return (
              <button
                key={person.name}
                type="button"
                onClick={() => chooseStaff(person.name)}
                aria-pressed={isActive}
                className={`rounded-xl border px-4 py-3 text-left font-semibold ${
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

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status);
          return (
            <section
              key={status}
              className="rounded-3xl bg-slate-200/60 p-3 sm:p-4"
              aria-label={STATUS_LABELS[status]}
            >
              <h3 className="flex items-center justify-between px-1 font-bold">
                {STATUS_LABELS[status]}
                <span className="rounded-full bg-white px-2.5 py-0.5 text-sm">
                  {columnTasks.length}
                </span>
              </h3>

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
                        {action ? (
                          <button
                            type="button"
                            onClick={() => void moveTask(task)}
                            disabled={busyId === task.id}
                            className="mt-3 w-full rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyId === task.id ? "Saving..." : action.label}
                          </button>
                        ) : (
                          <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-center font-semibold text-emerald-800">
                            Done
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
