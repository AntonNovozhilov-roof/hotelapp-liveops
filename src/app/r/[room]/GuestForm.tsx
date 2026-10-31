"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import {
  DEPARTMENT_LABELS,
  TASK_TYPE_LABELS,
  type MessageMode,
  type StoredTask,
  type TaskStatus,
} from "@/lib/tasks";

const POLL_MS = 3000;
const MAX_RECORD_SECONDS = 45;

/** Simple words for the guest. In review still shows "On the way": Done only after supervisor approval. */
const GUEST_STATUS: Record<TaskStatus, { label: string; tone: string }> = {
  new: { label: "Received", tone: "brand" },
  accepted: { label: "Received", tone: "brand" },
  in_progress: { label: "On the way", tone: "occ" },
  review: { label: "On the way", tone: "occ" },
  done: { label: "Done", tone: "ready" },
};

interface Heard {
  transcript: string;
  language: string;
}

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
  // Only the tasks created by the last message sent in THIS browser tab.
  // Never the room history (privacy: could be a previous guest's requests).
  const [sentTasks, setSentTasks] = useState<StoredTask[]>([]);
  const [lastMode, setLastMode] = useState<MessageMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [heard, setHeard] = useState<Heard | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // True after a voice transcript lands in the text box, until the guest sends it.
  const [voiceReady, setVoiceReady] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const sentIds = sentTasks.map((task) => task.id).join(",");

  const refreshSentTasks = useCallback(async () => {
    if (!sentIds) return;
    try {
      // Ask only for this message's task IDs, never the whole room history.
      const response = await fetch(
        `/api/tasks?ids=${encodeURIComponent(sentIds)}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { tasks: StoredTask[] };
      const order = sentIds.split(",");
      const byId = new Map(data.tasks.map((task) => [task.id, task]));
      setSentTasks(
        order
          .map((id) => byId.get(id))
          .filter((task): task is StoredTask => Boolean(task)),
      );
    } catch {
      // Keep showing the last known status if a refresh fails.
    }
  }, [sentIds]);

  // Live status for this message's tasks only, every few seconds.
  useEffect(() => {
    if (!sentIds) return;
    const timer = setInterval(() => void refreshSentTasks(), POLL_MS);
    return () => clearInterval(timer);
  }, [refreshSentTasks, sentIds]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      const response = await fetch("/api/guest/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, room }),
      });
      const data = (await response.json()) as {
        mode?: MessageMode;
        error?: string;
        tasks?: StoredTask[];
      };
      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      if (data.mode) setLastMode(data.mode);
      // Confirmation shows only this message's tasks.
      setSentTasks(data.tasks ?? []);
    },
    [room],
  );

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError(null);
    try {
      await sendText(text);
      setMessage("");
      setVoiceReady(false);
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

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  async function handleRecorded(blob: Blob) {
    setIsTranscribing(true);
    setVoiceError(null);
    try {
      const wav = await blobToWav(blob);
      const form = new FormData();
      form.append("audio", wav, "recording.wav");
      form.append("room", room);

      const response = await fetch("/api/guest/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        transcript?: string;
        language?: string;
        error?: string;
      };
      if (!response.ok || !data.transcript) {
        throw new Error(
          data.error ||
            "We could not understand that recording. Please try again, or type your request instead.",
        );
      }

      setHeard({
        transcript: data.transcript,
        language: data.language || "Unknown",
      });
      // Do NOT create tasks yet: the guest checks and can fix the text first.
      setMessage(data.transcript);
      setVoiceReady(true);
    } catch (transcribeError) {
      setVoiceError(
        transcribeError instanceof Error &&
          transcribeError.message !== "unsupported"
          ? transcribeError.message
          : "Voice did not work on this device. Please type your request instead.",
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (isTranscribing || isSending) return;

    setVoiceError(null);
    setHeard(null);
    setVoiceReady(false);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceError(
        "Voice recording is not supported in this browser. Please type your request instead.",
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (micError) {
      const name =
        micError instanceof DOMException ? micError.name : "";
      setVoiceError(
        name === "NotFoundError" || name === "DevicesNotFoundError"
          ? "No microphone was found. Please type your request instead."
          : "The microphone is blocked. Please allow microphone access in your browser, or type your request instead.",
      );
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setVoiceError(
        "Voice recording is not supported in this browser. Please type your request instead.",
      );
      return;
    }

    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stopTimer();
      setIsRecording(false);
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      if (blob.size > 0) void handleRecorded(blob);
    };

    startedAtRef.current = Date.now();
    setRecordingSeconds(0);
    recorder.start(250);
    setIsRecording(true);
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setRecordingSeconds(elapsed);
      if (elapsed >= MAX_RECORD_SECONDS) stopRecording();
    }, 250);
  }

  return (
    <div>
      <Card className="p-5">
        <form onSubmit={handleSend}>
          <label htmlFor="guest-message" className="text-[15px] font-semibold text-ink">
            What do you need?
          </label>
          {voiceReady && (
            <p className="mt-3 rounded-xl bg-brand-50 px-3.5 py-3 text-[13.5px] font-semibold text-brand-800">
              Check the text and fix it if needed, then press Send.
            </p>
          )}
          <Textarea
            id="guest-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Example: There is a leak in the bathroom and please bring towels"
            className="mt-3 text-[15px]"
          />
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              size="lg"
              variant={isRecording ? "danger" : "dark"}
              onClick={() => void toggleRecording()}
              disabled={isTranscribing || isSending}
              aria-pressed={isRecording}
              icon={<Mic className="size-4" />}
            >
              {isRecording ? "Stop" : isTranscribing ? "Listening..." : "Mic"}
            </Button>
            <Button
              type="submit"
              size="lg"
              loading={isSending}
              disabled={isRecording || !message.trim()}
              icon={isSending ? undefined : <Send className="size-4" />}
              className="flex-1"
            >
              {isSending ? "Sending..." : "Send"}
            </Button>
          </div>
          {isRecording && (
            <p aria-live="polite" className="mt-3 text-center text-[13.5px] font-semibold text-dirty-deep">
              Recording… {formatSeconds(recordingSeconds)} /{" "}
              {formatSeconds(MAX_RECORD_SECONDS)}
            </p>
          )}
          {isTranscribing && (
            <p aria-live="polite" className="mt-3 text-center text-[13.5px] text-ink-3">
              Turning your voice into text...
            </p>
          )}
          <p className="mt-3 text-center text-[12.5px] text-ink-4">
            Press Mic, speak, press Stop. Or type. One message can create more
            than one task.
          </p>
        </form>
      </Card>

      {voiceError && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-occ-soft px-3.5 py-3 text-[13.5px] text-occ-deep"
        >
          {voiceError}
        </div>
      )}

      {heard && (
        <div className="mt-4 rounded-xl bg-brand-50 ring-1 ring-brand-100 px-3.5 py-3">
          <p className="text-[14px] font-semibold text-ink">We heard: {heard.transcript}</p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Language: {heard.language}
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep"
        >
          {error}
        </div>
      )}

      {sentTasks.length > 0 && (
        <section aria-live="polite" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <h2 className="font-display text-[17px] font-semibold">Sent</h2>
            {lastMode === "MOCK" && <Badge tone="occ">MOCK</Badge>}
            {lastMode === "LIVE" && <Badge tone="brand">LIVE AI</Badge>}
          </div>

          {lastMode === "MOCK" && (
            <p className="mt-2 px-1 text-[12.5px] text-ink-3">
              MOCK means: no AI key is set on the server, so these are fake
              example tasks. Tasks are still saved and staff can work on
              them.
            </p>
          )}

          <ul className="mt-3 space-y-2">
            {sentTasks.map((task) => (
              <li key={task.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <p className="text-[14px] font-semibold">
                    Sent to {DEPARTMENT_LABELS[task.department]}: {task.title}
                  </p>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral">
                      {TASK_TYPE_LABELS[task.type]}
                    </Badge>
                    <Badge tone={GUEST_STATUS[task.status].tone} dot>
                      {GUEST_STATUS[task.status].label}
                    </Badge>
                  </span>
                </Card>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-[11.5px] text-ink-4">
            Status updates automatically every few seconds.
          </p>
        </section>
      )}
    </div>
  );
}
