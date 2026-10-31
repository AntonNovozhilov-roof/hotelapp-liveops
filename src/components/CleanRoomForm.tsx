"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

/** "Clean room <number>" form for supervisor/owner homes (T1 / ANT-39). */
export default function CleanRoomForm() {
  const router = useRouter();
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const value = room.trim();
    if (!value || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: value }),
      });
      const data = (await response.json()) as {
        error?: string;
        task?: { title: string };
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not create the task.");
      }
      setMessage(`Created: ${data.task?.title ?? `Clean room ${value}`}. Aigerim (Housekeeping) can see it now.`);
      setRoom("");
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create the task.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create}>
      <label
        htmlFor="clean-room-number"
        className="text-[13px] font-semibold text-ink-2"
      >
        Room number
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <Input
          id="clean-room-number"
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          placeholder="204"
          inputMode="numeric"
          className="w-32"
        />
        <Button type="submit" loading={busy} disabled={!room.trim()}>
          {busy ? "Creating..." : "Create cleaning task"}
        </Button>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">
        Creates a “Clean room …” cleaning task for Housekeeping, for
        example after check-out.
      </p>
      {message && (
        <p className="mt-2 rounded-xl bg-ready-soft px-3 py-2 text-[13px] font-semibold text-ready-deep">
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-xl bg-dirty-soft px-3 py-2 text-[13px] text-dirty-deep"
        >
          {error}
        </p>
      )}
    </form>
  );
}
