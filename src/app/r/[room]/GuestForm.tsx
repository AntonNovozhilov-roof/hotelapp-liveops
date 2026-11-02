"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import type { MessageMode, TaskStatus } from "@/lib/tasks";

const POLL_MS = 3000;
const MAX_RECORD_SECONDS = 45;

/** The only task data a guest ever sees (SEC1): id, title, status. */
interface GuestTask { id: string; title: string; status: TaskStatus }

interface Heard { transcript: string; language: string }
type EntryKind = "guest" | "assistant" | "status";
interface Entry { id: string; kind: EntryKind; text: string; mode?: MessageMode | null }

const STATUS_LINE: Partial<Record<TaskStatus, (title: string) => string>> = {
  accepted: () => "Our team accepted your request",
  in_progress: () => "Our team is on the way",
  review: () => "Our team is finishing your request",
  done: (title) => `Done ✓ — ${title}`,
};

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Convert a browser recording (WebM/MP4/etc.) to WAV 24 kHz mono 16-bit PCM. Meta ASR accepts only WAV. */
async function blobToWav(blob: Blob): Promise<Blob> {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("unsupported");
  }
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const sampleRate = 24000;
    const offline = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(decoded.duration * sampleRate)),
      sampleRate,
    );
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), sampleRate);
  } finally {
    await context.close().catch(() => undefined);
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample * (sample < 0 ? 0x8000 : 0x7fff), true);
  }
  return new Blob([view], { type: "audio/wav" });
}


export default function GuestForm({ room }: { room: string }) {
  const [message, setMessage] = useState("");
  // Chat lives ONLY in this browser tab (useState, never stored): refresh starts clean. Privacy.
  const [entries, setEntries] = useState<Entry[]>([
    { id: "welcome", kind: "assistant", text: "Hi! Tell me what you need — for example “please bring two towels”, or ask me about the Wi-Fi or breakfast." },
  ]);
  const [allTasks, setAllTasks] = useState<GuestTask[]>([]);
  const [lastMode, setLastMode] = useState<MessageMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [heard, setHeard] = useState<Heard | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const statusRef = useRef<Map<string, TaskStatus>>(new Map());
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const allIds = allTasks.map((t) => t.id).join(",");

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [entries]);

  const refreshTasks = useCallback(async () => {
    if (!allIds) return;
    try {
      // Guest endpoint: the signed guest cookie proves these are our tasks.
      const response = await fetch("/api/guest/tasks", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { tasks: GuestTask[] };
      const order = allIds.split(",");
      const byId = new Map(data.tasks.map((t) => [t.id, t]));
      const ordered = order.map((id) => byId.get(id)).filter((t): t is GuestTask => Boolean(t));
      // Live status lines when staff move a task.
      for (const task of ordered) {
        const prev = statusRef.current.get(task.id);
        statusRef.current.set(task.id, task.status);
        if (prev && prev !== task.status) {
          const make = STATUS_LINE[task.status];
          if (make) {
            setEntries((p) => [...p, { id: `status-${task.id}-${task.status}`, kind: "status", text: make(task.title) }]);
          }
        }
      }
      setAllTasks(ordered);
    } catch { /* keep last known */ }
  }, [allIds]);

  useEffect(() => {
    if (!allIds) return;
    const timer = setInterval(() => void refreshTasks(), POLL_MS);
    return () => clearInterval(timer);
  }, [refreshTasks, allIds]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || isSending) return;
    const history = entriesRef.current.filter((e) => e.kind === "guest" || e.kind === "assistant").slice(-6).map((e) => ({ role: e.kind, content: e.text }));
    setEntries((p) => [...p, { id: `g-${Date.now()}`, kind: "guest", text }]);
    setIsSending(true); setError(null);
    try {
      const response = await fetch("/api/guest/message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, room, history }),
      });
      const data = (await response.json()) as { mode?: MessageMode; error?: string; reply?: string; tasks?: GuestTask[] };
      if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      if (data.mode) setLastMode(data.mode);
      const newTasks = data.tasks ?? [];
      for (const t of newTasks) statusRef.current.set(t.id, t.status);
      if (newTasks.length) setAllTasks((p) => [...p, ...newTasks]);
      setEntries((p) => [...p, { id: `a-${Date.now()}`, kind: "assistant", text: data.reply || "Done — I've passed that to our team.", mode: data.mode ?? null }]);
      setMessage(""); setVoiceReady(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally { setIsSending(false); }
  }

  function stopTimer() { if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; } }
  function stopRecording() { if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop(); }

  async function handleRecorded(blob: Blob) {
    setIsTranscribing(true); setVoiceError(null);
    try {
      const wav = await blobToWav(blob);
      const form = new FormData();
      form.append("audio", wav, "recording.wav"); form.append("room", room);
      const response = await fetch("/api/guest/transcribe", { method: "POST", body: form });
      const data = (await response.json()) as { transcript?: string; language?: string; error?: string };
      if (!response.ok || !data.transcript) throw new Error(data.error || "We could not understand that recording. Please try again, or type your request instead.");
      setHeard({ transcript: data.transcript, language: data.language || "Unknown" });
      setMessage(data.transcript); setVoiceReady(true);
    } catch (e) {
      setVoiceError(e instanceof Error && e.message !== "unsupported" ? e.message : "Voice did not work on this device. Please type your request instead.");
    } finally { setIsTranscribing(false); }
  }

  async function toggleRecording() {
    if (isRecording) { stopRecording(); return; }
    if (isTranscribing || isSending) return;
    setVoiceError(null); setHeard(null); setVoiceReady(false);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Voice recording is not supported in this browser. Please type your request instead."); return;
    }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (micError) {
      const name = micError instanceof DOMException ? micError.name : "";
      setVoiceError(name === "NotFoundError" || name === "DevicesNotFoundError" ? "No microphone was found. Please type your request instead." : "The microphone is blocked. Please allow microphone access in your browser, or type your request instead.");
      return;
    }
    streamRef.current = stream; chunksRef.current = [];
    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(stream); } catch { stream.getTracks().forEach((t) => t.stop()); setVoiceError("Voice recording is not supported in this browser. Please type your request instead."); return; }
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      stopTimer(); setIsRecording(false); stream.getTracks().forEach((t) => t.stop()); streamRef.current = null;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); chunksRef.current = [];
      if (blob.size > 0) void handleRecorded(blob);
    };
    startedAtRef.current = Date.now(); setRecordingSeconds(0); recorder.start(250); setIsRecording(true);
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setRecordingSeconds(elapsed);
      if (elapsed >= MAX_RECORD_SECONDS) stopRecording();
    }, 250);
  }

  return (
    <div>
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">Chat with us</h2>
          {lastMode === "MOCK" && <Badge tone="occ">MOCK</Badge>}
          {lastMode === "LIVE" && <Badge tone="brand">LIVE AI</Badge>}
        </div>
        {lastMode === "MOCK" && <p className="mt-1 text-[12.5px] text-ink-3">MOCK mode: no AI key on the server, so replies are simple examples. Tasks are still saved for staff.</p>}
        <div className="mt-3 space-y-2 max-h-[52vh] overflow-y-auto pr-1" aria-live="polite">
          {entries.map((entry) => entry.kind === "status" ? (
            <p key={entry.id} className="text-center text-[12.5px] font-semibold text-brand-700 py-1">{entry.text}</p>
          ) : entry.kind === "guest" ? (
            <div key={entry.id} className="flex justify-end"><p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 text-white px-3.5 py-2.5 text-[14px]">{entry.text}</p></div>
          ) : (
            <div key={entry.id} className="flex justify-start"><div className="max-w-[85%]"><p className="rounded-2xl rounded-bl-md bg-canvas ring-1 ring-line px-3.5 py-2.5 text-[14px] text-ink">{entry.text}</p>{entry.mode === "MOCK" && <span className="mt-1 inline-block"><Badge tone="occ">MOCK reply</Badge></span>}</div></div>
          ))}
          {isSending && <p className="text-[12.5px] text-ink-3">One moment…</p>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="mt-3">
          <label htmlFor="guest-message" className="sr-only">What do you need?</label>
          {voiceReady && <p className="mb-2 rounded-xl bg-brand-50 px-3.5 py-3 text-[13.5px] font-semibold text-brand-800">Check the text and fix it if needed, then press Send.</p>}
          <Textarea id="guest-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} placeholder="Example: There is a leak in the bathroom and please bring towels" className="text-[15px]" />
          <div className="mt-3 flex gap-2">
            <Button type="button" size="lg" variant={isRecording ? "danger" : "dark"} onClick={() => void toggleRecording()} disabled={isTranscribing || isSending} aria-pressed={isRecording} icon={<Mic className="size-4" />}>{isRecording ? "Stop" : isTranscribing ? "Listening..." : "Mic"}</Button>
            <Button type="submit" size="lg" loading={isSending} disabled={isRecording || !message.trim()} icon={isSending ? undefined : <Send className="size-4" />} className="flex-1">{isSending ? "Sending..." : "Send"}</Button>
          </div>
          {isRecording && <p aria-live="polite" className="mt-3 text-center text-[13.5px] font-semibold text-dirty-deep">Recording… {formatSeconds(recordingSeconds)} / {formatSeconds(MAX_RECORD_SECONDS)}</p>}
          {isTranscribing && <p aria-live="polite" className="mt-3 text-center text-[13.5px] text-ink-3">Turning your voice into text...</p>}
          <p className="mt-3 text-center text-[12.5px] text-ink-4">Your requests go to hotel staff. This chat lives only in this tab — refresh starts a clean chat.</p>
        </form>
      </Card>

      {voiceError && <div role="alert" className="mt-4 rounded-xl bg-occ-soft px-3.5 py-3 text-[13.5px] text-occ-deep">{voiceError}</div>}
      {heard && <div className="mt-4 rounded-xl bg-brand-50 ring-1 ring-brand-100 px-3.5 py-3"><p className="text-[14px] font-semibold text-ink">We heard: {heard.transcript}</p><p className="mt-1 text-[12.5px] text-ink-3">Language: {heard.language}</p></div>}
      {error && <div role="alert" className="mt-4 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep">{error}</div>}
    </div>
  );
}
