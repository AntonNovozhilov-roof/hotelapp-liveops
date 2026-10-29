"use client";

import { useState } from "react";
import type { MessageMode, Task } from "@/lib/tasks";

interface ApiResult {
  mode: MessageMode;
  room: string;
  tasks: Task[];
}

const DEPARTMENT_LABELS: Record<Task["department"], string> = {
  maintenance: "Maintenance",
  housekeeping: "Housekeeping",
  front_desk: "Front desk",
  room_service: "Room service",
};

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
};

export default function GuestForm({ room }: { room: string }) {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/guest/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, room }),
      });
      const data = (await response.json()) as ApiResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setResult(data);
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
      <form onSubmit={handleSend} className="rounded-3xl bg-white p-6 shadow-sm">
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

      {result && (
        <section aria-live="polite" className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              Tasks created ({result.tasks.length})
            </h2>
            {result.mode === "MOCK" ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
                MOCK
              </span>
            ) : (
              <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-bold text-teal-900">
                LIVE AI
              </span>
            )}
          </div>

          {result.mode === "MOCK" && (
            <p className="mt-2 text-sm text-slate-600">
              MOCK means: no AI key is set yet, so these are fake example tasks.
              The real AI will be used when a key is added.
            </p>
          )}

          <ul className="mt-4 space-y-3">
            {result.tasks.map((task, index) => (
              <li
                key={`${task.department}-${task.title}-${index}`}
                className="rounded-2xl bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{task.title}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${PRIORITY_STYLES[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Team: {DEPARTMENT_LABELS[task.department]} · Room {room} ·
                  Confidence: {Math.round(task.confidence * 100)}%
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
