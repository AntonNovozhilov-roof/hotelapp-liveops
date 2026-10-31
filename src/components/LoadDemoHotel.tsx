"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/** "Load demo hotel" (H1) — Owner only; the server refuses everyone else too. */
export default function LoadDemoHotel({ onLoaded }: { onLoaded?: () => Promise<void> | void }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/demo", { method: "POST" });
      const data = (await response.json()) as { error?: string; roomsAdded?: number; tasksCreated?: number };
      if (!response.ok) throw new Error(data.error || "Could not load the demo hotel.");
      setMessage(`Demo hotel loaded: ${data.roomsAdded ?? 0} new rooms (101–110 and 201–210), a sample hotel info sheet and ${data.tasksCreated ?? 0} sample tasks. All of it is demo data — remove it any time with Reset demo data on the Owner home.`);
      if (onLoaded) await onLoaded();
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load the demo hotel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button loading={busy} onClick={() => void load()}>Load demo hotel</Button>
      {message && <p className="mt-2 text-[13px] text-ink-3" role="status">{message}</p>}
    </div>
  );
}
