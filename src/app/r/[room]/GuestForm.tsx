"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEPARTMENT_LABELS,
  STATUS_LABELS,
  sortTasks,
  type MessageMode,
  type StoredTask,
  type TaskStatus,
} from "@/lib/tasks";

const POLL_MS = 3000;
const MAX_RECORD_SECONDS = 45;

const PRIORITY_STYLES: Record<StoredTask["priority"], string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  new: "bg-sky-100 text-sky-800",
  accepted: "bg-violet-100 text-violet-800",
  in_progress: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-800",
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
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [lastMode, setLastMode] = useState<MessageMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [heard, setHeard] = useState<Heard | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const loadTasks = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks?room=${encodeURIComponent(room)}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { tasks: StoredTask[] };
      setTasks(sortTasks(data.tasks).slice(0, 20));
    } catch {
      // Keep showing the last known tasks if a refresh fails.
    }
  }, [room]);

  // Live status: load on open, then refresh every few seconds.
  useEffect(() => {
    void loadTasks();
    const timer = setInterval(() => void loadTasks(), POLL_MS);
    return () => clearInterval(timer);
  }, [loadTasks]);

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
      };
      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      if (data.mode) setLastMode(data.mode);
      await loadTasks();
    },
    [loadTasks, room],
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
      setMessage(data.transcript);
      await sendText(data.transcript);
      setMessage("");
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
      <form onSubmit={handleSend} className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <label htmlFor="guest-message" className="font-semibold">
          What do you need?
        </label>
        <textarea
          id="guest-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Example: There is a leak in the bathroom and please bring towels"
          className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={isTranscribing || isSending}
            aria-pressed={isRecording}
            className={`shrink-0 rounded-xl px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-slate-700 hover:bg-slate-800"
            }`}
          >
            {isRecording ? "Stop" : isTranscribing ? "Listening..." : "Mic"}
          </button>
          <button
            type="submit"
            disabled={isSending || isRecording || !message.trim()}
            className="flex-1 rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
        {isRecording && (
          <p aria-live="polite" className="mt-3 text-center font-semibold text-red-700">
            Recording… {formatSeconds(recordingSeconds)} /{" "}
            {formatSeconds(MAX_RECORD_SECONDS)}
          </p>
        )}
        {isTranscribing && (
          <p aria-live="polite" className="mt-3 text-center text-slate-600">
            Turning your voice into text...
          </p>
        )}
        <p className="mt-3 text-center text-sm text-slate-500">
          Press Mic, speak, press Stop. Or type. One message can create more
          than one task.
        </p>
      </form>

      {voiceError && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
        >
          {voiceError}
        </div>
      )}

      {heard && (
        <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-4">
          <p className="font-semibold">We heard: {heard.transcript}</p>
          <p className="mt-1 text-sm text-slate-600">
            Language: {heard.language}
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
        </div>
      )}

      <section aria-live="polite" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Your tasks ({tasks.length})</h2>
          {lastMode === "MOCK" && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
              MOCK
            </span>
          )}
          {lastMode === "LIVE" && (
            <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-bold text-teal-900">
              LIVE AI
            </span>
          )}
        </div>

        {lastMode === "MOCK" && (
          <p className="mt-2 text-sm text-slate-600">
            MOCK means: no AI key is set on the server, so these are fake
            example tasks. Tasks are still saved and staff can work on them.
          </p>
        )}

        {tasks.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-4 text-slate-600 shadow-sm">
            No tasks yet. Write a request above and press Send.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tasks.map((task) => (
              <li key={task.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{task.title}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${PRIORITY_STYLES[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>
                    Team: {DEPARTMENT_LABELS[task.department]} · Room {room} ·
                    Confidence: {Math.round(task.confidence * 100)}%
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[task.status]}`}
                  >
                    {STATUS_LABELS[task.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-center text-xs text-slate-500">
          Status updates automatically every few seconds.
        </p>
      </section>
    </div>
  );
}
