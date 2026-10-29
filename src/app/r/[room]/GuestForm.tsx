"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEPARTMENT_LABELS,
  STATUS_LABELS,
  sortTasks,
  type MessageMode,
  type StoredTask,
  type TaskStatus,
} from "@/lib/tasks";

const POLL_MS = 3000;

const PRIORITY_STYLES: Record<StoredTask["priority"], string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  new: "bg-sky-100 text-sky-800",
  accepted: "bg-violet-100 text-violet-800",
  in_progress: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-800",
};

export default function GuestForm({ room }: { room: string }) {
  const [message, setMessage] = useState("");
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [lastMode, setLastMode] = useState<MessageMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks?room=${encodeURIComponent(room)}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { tasks: StoredTask[] };
      setTasks(sortTasks(data.tasks).slice(0, 20));
    } catch {
      // Keep showing the last known tasks if a refresh fails.
    }
  }, [room]);

  // Live status: load on open, then refresh every few seconds.
  useEffect(() => {
    void loadTasks();
    const timer = setInterval(() => void loadTasks(), POLL_MS);
    return () => clearInterval(timer);
  }, [loadTasks]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/guest/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, room }),
      });
      const data = (await response.json()) as {
        mode?: MessageMode;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      if (data.mode) setLastMode(data.mode);
      setMessage("");
      await loadTasks();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSend} className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <label htmlFor="guest-message" className="font-semibold">
          What do you need?
        </label>
        <textarea
          id="guest-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Example: There is a leak in the bathroom and please bring towels"
          className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
        <button
          type="submit"
          disabled={isSending || !message.trim()}
          className="mt-4 w-full rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
        <p className="mt-3 text-center text-sm text-slate-500">
          One message can create more than one task.
        </p>
      </form>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
        </div>
      )}

      <section aria-live="polite" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Your tasks ({tasks.length})</h2>
          {lastMode === "MOCK" && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
              MOCK
            </span>
          )}
          {lastMode === "LIVE" && (
            <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-bold text-teal-900">
              LIVE AI
            </span>
          )}
        </div>

        {lastMode === "MOCK" && (
          <p className="mt-2 text-sm text-slate-600">
            MOCK means: no AI key is set on the server, so these are fake
            example tasks. Tasks are still saved and staff can work on them.
          </p>
        )}

        {tasks.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-4 text-slate-600 shadow-sm">
            No tasks yet. Write a request above and press Send.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tasks.map((task) => (
              <li key={task.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{task.title}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${PRIORITY_STYLES[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>
                    Team: {DEPARTMENT_LABELS[task.department]} · Room {room} ·
                    Confidence: {Math.round(task.confidence * 100)}%
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[task.status]}`}
                  >
                    {STATUS_LABELS[task.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-center text-xs text-slate-500">
          Status updates automatically every few seconds.
        </p>
      </section>
    </div>
  );
}
