"use client";

import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";

interface Counts {
  deleted: { tasks: number; employees: number };
  seeded: { rooms: number; bookings: number; tasks: number; historyEvents: number };
}

/**
 * Secret-code form for /admin/restore. Step 1: the code (checked only on
 * the server). Step 2: "This deletes everything. Type RESTORE to
 * continue". The code is never stored anywhere in the browser.
 */
export default function RestoreForm() {
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"code" | "confirm" | "done">("code");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, confirm }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; counts?: Counts };
      if (!res.ok || !data.counts) throw new Error(data.error || "The restore did not work. Nothing may have changed — check the app before trying again.");
      setCounts(data.counts);
      setStep("done");
      setCode("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The restore did not work.");
      setStep("code");
      setConfirm("");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done" && counts) {
    return (
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Clean demo restored</h2>
        <p className="mt-2 text-[13.5px] text-ink-3" role="status">
          Deleted: {counts.deleted.tasks} tasks (with their photos), {counts.deleted.employees} team accounts, plus all history, reports, conversations, bookings, rooms and counters.
        </p>
        <p className="mt-1.5 text-[13.5px] text-ink-3">
          Fresh demo hotel: {counts.seeded.rooms} rooms on 2 floors, {counts.seeded.bookings} bookings, {counts.seeded.tasks} tasks in every stage, {counts.seeded.historyEvents} history events starting with “Demo restored”. Demo accounts (owner, supervisor, aigerim, ruslan, daniyar, madina) are unchanged.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      {error && <p className="mb-3 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep" role="alert">{error}</p>}
      {step === "code" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) setStep("confirm");
          }}
        >
          <Field label="Secret restore code" hint="The RESTORE_SECRET value from the server settings. A normal sign-in is not enough — this is checked only on the server. 5 tries per 10 minutes.">
            <Input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="Paste the secret code" />
          </Field>
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={!code.trim()}>
            Continue
          </Button>
        </form>
      ) : (
        <div>
          <p className="rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] font-semibold text-dirty-deep">
            This deletes everything. Type RESTORE to continue
          </p>
          <p className="mt-2 text-[13px] text-ink-3">
            All tasks and photos, history, reports, guest conversations, bookings, rooms, hotel info, team accounts and counters will be deleted, and a fresh demo hotel will be loaded. Demo accounts stay as they are.
          </p>
          <div className="mt-3">
            <Field label="Type RESTORE">
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" placeholder="RESTORE" />
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" disabled={busy} onClick={() => { setStep("code"); setConfirm(""); }}>
              Back
            </Button>
            <Button variant="danger" size="lg" loading={busy} disabled={confirm !== "RESTORE"} onClick={() => void run()}>
              {busy ? "Restoring…" : "Delete all and restore"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
