"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, Input } from "@/components/ui";
import {
  DEPARTMENT_LABELS,
  STAFF,
  aiNeedsAttention,
  timeAgo,
  type StoredTask,
} from "@/lib/tasks";

/**
 * Supervisor review queue (M7 / ANT-23): cleaning tasks In review,
 * ordered AI "not found"/"not sure" first, then oldest first (order is
 * set on the server by sortReviewTasks). Approve is one tap; Send back
 * needs a short note staff will see. The Owner can use this page too —
 * the server checks the role on every action.
 */
export type ReferenceByRoom = Record<
  string,
  { photos: { name: string; url: string; label: string }[] } | null
>;

/** Simple AI verdict words for the supervisor (P1) — no items or counts. */
function supervisorVerdict(task: StoredTask): string {
  const check = task.aiCheck;
  if (!check) return "AI not sure";
  if (check.verdict === "ready")
    return check.comparedToReference
      ? "✓ Looks like the perfect photo"
      : "✓ Looks ready";
  if (check.verdict === "different")
    return check.comparedToReference
      ? "Different from perfect photo"
      : "Looks different — check the photos";
  return "AI not sure";
}

export default function SupervisorBoard({
  tasks,
  references = {},
}: {
  tasks: StoredTask[];
  references?: ReferenceByRoom;
}) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the queue in sync when the server page refreshes after an action.
  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  async function act(task: StoredTask, action: "approve" | "send_back") {
    const note = (notes[task.id] ?? "").trim();
    if (busyId) return;
    if (action === "send_back" && !note) {
      setError("Please add a short note when sending a task back.");
      return;
    }
    setBusyId(task.id);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approve" ? { action } : { action, note },
        ),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not update the task.");
      }
      setItems((current) => current.filter((item) => item.id !== task.id));
      setMessage(
        action === "approve"
          ? `Approved: ${task.title} (room ${task.room}). The guest now sees Done.`
          : `Sent back: ${task.title} (room ${task.room}). Staff see your note and fix it.`,
      );
      router.refresh();
    } catch (actError) {
      setError(
        actError instanceof Error ? actError.message : "Could not update the task.",
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
          No cleaning tasks waiting for review. When staff send cleaning work
          to review, it appears here — AI problems first, then oldest first.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((task) => {
            const cleaner =
              STAFF.find((person) => person.department === task.department)
                ?.name ?? DEPARTMENT_LABELS[task.department];
            const needsAttention = aiNeedsAttention(task);
            const verdict = supervisorVerdict(task);
            const reference = references[task.room] ?? null;
            return (
              <li key={task.id}>
                <Card className="h-full p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-[13px] font-semibold text-brand-700">
                        Room {task.room}
                      </p>
                      <p className="mt-1 text-[14.5px] font-semibold leading-snug">
                        {task.title}
                      </p>
                    </div>
                    <span className="flex flex-wrap gap-1.5">
                      {task.flaggedTwice && (
                        <Badge tone="dirty" dot>
                          Failed AI check twice
                        </Badge>
                      )}
                      {needsAttention && !task.flaggedTwice && (
                        <Badge tone="dirty" dot>
                          AI: check this
                        </Badge>
                      )}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-ink-3">
                    Cleaned by {cleaner} ·{" "}
                    {DEPARTMENT_LABELS[task.department]} · sent to review{" "}
                    {timeAgo(task.updatedAt)}
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[12px] font-semibold text-ink-3">Perfect photo</p>
                      {reference && reference.photos.length > 0 ? (
                        <ul className="mt-1.5 grid grid-cols-3 gap-2">
                          {reference.photos.map((photo) => (
                            <li key={photo.name}>
                              <a href={photo.url} target="_blank" rel="noreferrer" aria-label="Open perfect photo full size">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo.url} alt="Perfect room photo" className="aspect-square w-full rounded-xl border border-line object-cover" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[12.5px] text-ink-4">No perfect photo for room {task.room} yet. Ask the owner to add one.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-ink-3">Latest photos</p>
                      {task.photos.length > 0 ? (
                        <ul className="mt-1.5 grid grid-cols-3 gap-2">
                          {task.photos.map((photo) => (
                            <li key={photo.name}>
                              <a href={photo.url} target="_blank" rel="noreferrer" aria-label="Open photo full size">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo.url} alt="Cleaning photo" className="aspect-square w-full rounded-xl border border-line object-cover" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[12.5px] text-ink-4">No photos saved.</p>
                      )}
                    </div>
                  </div>

                  <p className={`mt-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold ${task.aiCheck?.verdict === "ready" ? "bg-ready-soft text-ready-deep" : task.aiCheck?.verdict === "different" ? "bg-dirty-soft text-dirty-deep" : "bg-occ-soft text-occ-deep"}`}>
                    {verdict}
                    {task.aiCheck?.mode === "MOCK" && <span className="ml-2"><Badge tone="occ">MOCK</Badge></span>}
                  </p>

                  <p className="mt-2 text-[12.5px]">
                    <Link href={`/history?task=${task.id}`} className="font-semibold text-brand-700 hover:underline">
                      Timeline
                    </Link>
                  </p>
                  <Button
                    size="lg"
                    loading={busyId === task.id}
                    onClick={() => void act(task, "approve")}
                    className="mt-3 w-full"
                  >
                    {busyId === task.id ? "Saving..." : "Approve"}
                  </Button>
                  <form
                    className="mt-2 flex flex-wrap gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void act(task, "send_back");
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
                      placeholder="Note for staff, e.g. towels missing"
                      aria-label="Send-back note"
                      className="min-w-48 flex-1"
                    />
                    <Button
                      type="submit"
                      variant="danger"
                      loading={busyId === task.id}
                      disabled={!(notes[task.id] ?? "").trim()}
                      icon={<RotateCcw className="size-4" />}
                    >
                      Send back
                    </Button>
                  </form>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
