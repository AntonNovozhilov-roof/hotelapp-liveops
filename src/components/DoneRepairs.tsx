"use client";

import { useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { sortForColumn, type StoredTask } from "@/lib/tasks";

/**
 * Finished repairs with their proof photos (T1 / ANT-39).
 * The photo stays on the done task so the supervisor and owner can
 * see it. Only the supervisor gets the Reopen form (server-checked too).
 */
export default function DoneRepairs({
  tasks,
  canReopen,
}: {
  tasks: StoredTask[];
  canReopen: boolean;
}) {
  const [items, setItems] = useState(() => sortForColumn(tasks, "done"));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reopen(task: StoredTask) {
    const note = (notes[task.id] ?? "").trim();
    if (!note || busyId) {
      if (!note) setError("Please add a short note when reopening a task.");
      return;
    }
    setBusyId(task.id);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen", note }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not reopen the task.");
      }
      setItems((current) => current.filter((item) => item.id !== task.id));
      setMessage(
        `Reopened: ${task.title} (room ${task.room}). Ruslan can see your note and fix it.`,
      );
    } catch (reopenError) {
      setError(
        reopenError instanceof Error
          ? reopenError.message
          : "Could not reopen the task.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {message && (
        <p className="mb-3 rounded-xl bg-ready-soft px-3 py-2 text-[13px] font-semibold text-ready-deep">
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-dirty-soft px-3 py-2 text-[13px] text-dirty-deep"
        >
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-[13.5px] text-ink-3">
          No finished repairs yet. When Ruslan finishes a repair, its proof
          photo stays here.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((task) => (
            <li key={task.id}>
              <Card className="p-4">
                <p className="font-display text-[13px] font-semibold text-brand-700">
                  Room {task.room} · Repair
                </p>
                <p className="mt-1 text-[14.5px] font-semibold leading-snug">
                  {task.title}
                </p>
                {task.photos.length > 0 ? (
                  <ul className="mt-3 grid grid-cols-3 gap-2 sm:max-w-xs">
                    {task.photos.map((photo) => (
                      <li key={photo.name}>
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open proof photo full size"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt="Repair proof photo"
                            className="aspect-square w-full rounded-xl border border-line object-cover"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[12.5px] text-ink-4">
                    No proof photo saved.
                  </p>
                )}
                {canReopen && (
                  <form
                    className="mt-3 flex flex-wrap gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void reopen(task);
                    }}
                  >
                    <Input
                      value={notes[task.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [task.id]: event.target.value,
                        }))
                      }
                      placeholder="Note for Ruslan, e.g. still dripping"
                      aria-label="Reopen note"
                      className="min-w-52 flex-1"
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      loading={busyId === task.id}
                      disabled={!(notes[task.id] ?? "").trim()}
                    >
                      Reopen
                    </Button>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
