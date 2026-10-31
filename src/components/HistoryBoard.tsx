"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Empty, Input } from "@/components/ui";
import { timeAgo } from "@/lib/tasks";

interface HistoryEventView {
  id: string;
  at: string;
  actorName: string;
  actorRole: string;
  room: string | null;
  taskId: string | null;
  taskTitle: string | null;
  taskType: string | null;
  action: string;
  details: string;
}

const TYPE_LABELS: Record<string, string> = {
  request: "Request",
  cleaning: "Cleaning",
  repair: "Repair",
};

export default function HistoryBoard({ focusTaskId }: { focusTaskId?: string }) {
  const [events, setEvents] = useState<HistoryEventView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  const [person, setPerson] = useState("");
  const [type, setType] = useState("");
  const [range, setRange] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (focusTaskId) params.set("task", focusTaskId);
      if (room.trim()) params.set("room", room.trim());
      if (person) params.set("person", person);
      if (type) params.set("type", type);
      if (range !== "all") params.set("range", range);
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/history?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { events?: HistoryEventView[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load the history.");
      setEvents(data.events ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the history.");
    } finally {
      setLoading(false);
    }
  }, [focusTaskId, room, person, type, range, search]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const people = useMemo(
    () => [...new Set(events.map((e) => e.actorName))].sort(),
    [events],
  );
  const focusTask = focusTaskId ? events[0] : undefined;

  return (
    <div>
      {focusTaskId && (
        <Card className="mb-4 p-4">
          <p className="text-[12.5px] font-medium text-ink-3">Task timeline</p>
          <p className="mt-1 font-display text-[18px] font-semibold">
            {focusTask ? `${focusTask.taskTitle ?? "Task"} · Room ${focusTask.room ?? "—"}` : "Task timeline"}
          </p>
          <p className="mt-1 text-[13px] text-ink-3">
            Every step from the guest request to done, in order.{" "}
            <Link href="/history" className="font-semibold text-brand-700 hover:underline">
              See the full history
            </Link>
          </p>
        </Card>
      )}

      {!focusTaskId && (
        <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search history"
          />
          <Input
            placeholder="Room, e.g. 205"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            aria-label="Filter by room"
          />
          <select
            className="h-11 sm:h-10 rounded-lg border border-line bg-white px-3 text-sm"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            aria-label="Filter by person"
          >
            <option value="">Everyone</option>
            {people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="h-11 sm:h-10 rounded-lg border border-line bg-white px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filter by task type"
          >
            <option value="">All task types</option>
            <option value="request">Request</option>
            <option value="cleaning">Cleaning</option>
            <option value="repair">Repair</option>
          </select>
          <select
            className="h-11 sm:h-10 rounded-lg border border-line bg-white px-3 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            aria-label="Filter by time"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[13.5px] text-ink-3">Loading…</p>
      ) : events.length === 0 ? (
        <Card>
          <Empty
            title={focusTaskId ? "No history for this task yet" : "No history yet"}
            text={
              focusTaskId
                ? "Steps appear here as people work on the task. Tasks made before history was added have no events."
                : "When guests ask for something and staff work on it, every step appears here. Try a different filter if you were looking for something older."
            }
          />
        </Card>
      ) : (
        <ol className="space-y-2">
          {(focusTaskId ? [...events].reverse() : events).map((event) => (
            <li key={event.id}>
              <Card className="p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14px] font-semibold">
                    {event.action}
                    {event.room ? <span className="text-brand-700"> · Room {event.room}</span> : null}
                  </p>
                  <time className="text-[12px] text-ink-4" title={new Date(event.at).toLocaleString()}>
                    {timeAgo(event.at)}
                  </time>
                </div>
                <p className="mt-0.5 text-[13px] text-ink-3">{event.details}</p>
                <p className="mt-1 text-[12.5px] text-ink-4">
                  {event.actorName}
                  {event.actorRole ? ` · ${event.actorRole}` : ""}
                  {event.taskTitle
                    ? ` · ${event.taskTitle}${event.taskType ? ` (${TYPE_LABELS[event.taskType] ?? event.taskType})` : ""}`
                    : ""}
                  {event.taskId && !focusTaskId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/history?task=${event.taskId}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        Timeline
                      </Link>
                    </>
                  ) : null}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4">
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
