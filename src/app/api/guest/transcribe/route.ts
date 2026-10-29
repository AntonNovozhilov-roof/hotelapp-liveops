import { NextResponse } from "next/server";
import { guessLanguage, languageFromMeta } from "@/lib/language";

// Official Meta docs (checked 2026-10-29):
// Speech to text: https://dev.meta.ai/docs/speech-to-text
// API reference: https://dev.meta.ai/docs/api-reference/voice/transcribe
// POST https://api.meta.ai/v1/asr/transcribe, multipart/form-data with
// "request" (JSON) + "audio" (WAV). Audio must be a RIFF/WAVE container
// with mono, 16-bit integer PCM at 16 kHz or 24 kHz.
// Response JSON: { sessionId, transcript, audioDurationMs, turns }.
// The official response schema has no detected-language field.
const TRANSCRIBE_URL = "https://api.meta.ai/v1/asr/transcribe";
const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function isWav(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WAVE"
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Voice is not available right now. Please type your request instead.",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "No audio received. Please try again or type your request." },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { error: "No audio received. Please try again or type your request." },
      { status: 400 },
    );
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "That recording is too long. Please record up to 45 seconds." },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (!isWav(bytes)) {
    return NextResponse.json(
      {
        error:
          "That audio format is not supported. Please try again, or type your request instead.",
      },
      { status: 415 },
    );
  }

  const metaForm = new FormData();
  metaForm.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          model: TRANSCRIBE_MODEL,
          audioEncoding: "WAV",
          mode: "PUSH_TO_TALK",
        }),
      ],
      { type: "application/json" },
    ),
  );
  metaForm.append(
    "audio",
    new File([bytes], "recording.wav", { type: "audio/wav" }),
  );

  let metaResponse: Response;
  try {
    metaResponse = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: metaForm,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "We could not reach the voice service. Please try again, or type your request instead.",
      },
      { status: 502 },
    );
  }

  if (!metaResponse.ok) {
    console.error(`Transcription failed: Meta API HTTP ${metaResponse.status}`);
    return NextResponse.json(
      {
        error:
          "We could not understand that recording. Please try again in a quiet place, or type your request instead.",
      },
      { status: 502 },
    );
  }

  const data = (await metaResponse.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const transcript =
    data && typeof data.transcript === "string" ? data.transcript.trim() : "";

  if (!data || !transcript) {
    return NextResponse.json(
      {
        error:
          "We did not hear any words in that recording. Please try again, or type your request instead.",
      },
      { status: 422 },
    );
  }

  const language = languageFromMeta(data) ?? guessLanguage(transcript);

  return NextResponse.json({
    transcript,
    language: language.name,
    languageCode: language.code,
    languageSource: language.source,
    model: TRANSCRIBE_MODEL,
    audioDurationMs:
      typeof data.audioDurationMs === "number" ? data.audioDurationMs : null,
  });
}
