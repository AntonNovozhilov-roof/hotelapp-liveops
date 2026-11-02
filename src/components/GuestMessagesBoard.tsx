"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Textarea } from "@/components/ui";

interface ConvMessage { id: string; sender: "guest" | "assistant" | "staff" | "system"; name: string | null; text: string; at: string }
interface Conv { id: string; room: string; status: string; staffName: string | null; createdAt: string; updatedAt: string; joinedAt?: string | null; messages: ConvMessage[] }
interface ConvSummary { id: string; room: string; status: string; staffName: string | null; createdAt: string; waitingSeconds: number; lastMessage: ConvMessage | null }

function waitingLabel(seconds: number): string {
  if (seconds < 60) return "just now";
  const m = Math.floor(seconds / 60);
  return m < 60 ? `${m} min waiting` : `${Math.floor(m / 60)} h ${m % 60} min waiting`;
}

export default function GuestMessagesBoard() {
  const [list, setList] = useState<ConvSummary[]>([]);
  const [current, setCurrent] = useState<Conv | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: ConvSummary[] };
      setList(data.conversations);
    } catch { /* keep last */ }
  }, []);

  const loadCurrent = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { conversation: Conv };
      setCurrent(data.conversation.status === "closed" ? null : data.conversation);
      if (data.conversation.status === "closed") void loadList();
    } catch { /* keep last */ }
  }, [loadList]);

  useEffect(() => {
    void loadList();
    const t = setInterval(() => void loadList(), 3000);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!current) return;
    const t = setInterval(() => void loadCurrent(current.id), 3000);
    return () => clearInterval(t);
  }, [current, loadCurrent]);

  async function act(action: string, text?: string) {
    if (!current) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/conversations/${current.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, text }) });
      const data = (await res.json().catch(() => ({}))) as { conversation?: Conv; error?: string };
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      if (action === "reply") setReply("");
      if (data.conversation && data.conversation.status !== "closed") setCurrent(data.conversation); else setCurrent(null);
      void loadList();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      <Card className="p-4">
        <h2 className="text-[15px] font-semibold">Open conversations</h2>
        {error && <p className="mt-2 rounded-xl bg-dirty-soft px-3 py-2 text-[13px] text-dirty-deep" role="alert">{error}</p>}
        {list.length === 0 ? (
          <p className="mt-3 rounded-xl bg-canvas px-3.5 py-3 text-[13.5px] text-ink-3">No guests are waiting for a person right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => void loadCurrent(c.id)} className={`min-h-11 w-full rounded-xl border p-3 text-left ${current?.id === c.id ? "border-brand-500 bg-brand-50" : "border-line bg-white hover:border-brand-500"}`}>
                  <span className="flex items-center justify-between gap-2">
                    <strong className="text-[14px]">Room {c.room}</strong>
                    {c.status === "waiting" ? <Badge tone="dirty">{waitingLabel(c.waitingSeconds)}</Badge> : <Badge tone="brand">{c.staffName ?? "Joined"}</Badge>}
                  </span>
                  <span className="mt-1 block truncate text-[13px] text-ink-3">{c.lastMessage ? `${c.lastMessage.sender === "guest" ? "Guest: " : ""}${c.lastMessage.text}` : "No messages yet"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        {!current ? (
          <p className="rounded-xl bg-canvas px-3.5 py-3 text-[13.5px] text-ink-3">Pick a conversation on the left to read it and reply. Newest waiting guests are first.</p>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Room {current.room}</h2>
              {current.status === "waiting" ? <Badge tone="dirty">Waiting for a person</Badge> : <Badge tone="brand">{current.staffName} is in this chat</Badge>}
            </div>
            <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto pr-1" aria-live="polite">
              {current.messages.map((m) => m.sender === "system" ? (
                <p key={m.id} className="py-1 text-center text-[12.5px] font-semibold text-brand-700">{m.text}</p>
              ) : m.sender === "guest" ? (
                <div key={m.id} className="flex justify-start"><p className="max-w-[85%] rounded-2xl rounded-bl-md bg-canvas px-3.5 py-2.5 text-[14px] ring-1 ring-line">{m.text}</p></div>
              ) : (
                <div key={m.id} className="flex justify-end"><div className="max-w-[85%]">{m.name && <p className="mb-1 text-right text-[12px] font-semibold text-brand-700">{m.name}</p>}<p className="rounded-2xl rounded-br-md bg-brand-700 px-3.5 py-2.5 text-[14px] text-white">{m.text}</p></div></div>
              ))}
            </div>
            {current.status === "waiting" && <Button className="mt-3" loading={busy} onClick={() => void act("join")}>Join this chat</Button>}
            <div className="mt-3">
              <label htmlFor="staff-reply" className="sr-only">Your reply</label>
              <Textarea id="staff-reply" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={2000} placeholder="Write a reply to the guest…" />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button loading={busy} disabled={!reply.trim()} onClick={() => void act("reply", reply.trim())}>Send reply</Button>
                <Button variant="secondary" disabled={busy} onClick={() => void act("handback")}>Hand back to the assistant</Button>
                <Button variant="danger" disabled={busy} onClick={() => { if (window.confirm("Close this conversation? The guest will start a clean chat.")) void act("close"); }}>Close conversation</Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
