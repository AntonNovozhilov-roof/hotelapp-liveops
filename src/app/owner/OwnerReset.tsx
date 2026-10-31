"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/** "Reset demo data" — Owner only; the server refuses everyone else too. */
export default function OwnerReset() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reset() {
    const confirmed = window.confirm(
      "Are you sure? This will delete ALL saved tasks for every room and team.",
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/tasks", { method: "DELETE" });
      const data = (await response.json()) as {
        error?: string;
        cleared?: number;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not clear the tasks.");
      }
      setMessage(`Demo data cleared (${data.cleared ?? 0} tasks removed).`);
      router.refresh();
    } catch (resetError) {
      setMessage(
        resetError instanceof Error
          ? resetError.message
          : "Could not clear the tasks.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button variant="danger" loading={busy} onClick={() => void reset()}>
        Reset demo data
      </Button>
      {message && <p className="mt-2 text-[13px] text-ink-3">{message}</p>}
    </div>
  );
}
