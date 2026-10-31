import { NextResponse } from "next/server";
import { getStoredTask, saveStoredTaskAiCheck } from "@/lib/store";
import { readPhoto } from "@/lib/photos";
import { mockAiCheck, runLivePhotoCheck } from "@/lib/photo-check";
import type { TaskAiCheck } from "@/lib/tasks";

/**
 * POST /api/tasks/[id]/ai-check — run the SAM 3.1 photo check (M5 / ANT-21).
 *
 * Sends the task photos to SAM (see src/lib/photo-check.ts for the official
 * docs and the exact wire format) and saves {score, checks, issues, model}
 * on the task. With no MODEL_API_KEY, or when SAM errors, it saves a clearly
 * marked MOCK result instead so the loop still works. The AI only helps the
 * supervisor — this route never changes the task status.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const task = await getStoredTask(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.photos.length === 0) {
    return NextResponse.json(
      {
        error: "Add at least 1 photo before running the AI photo check.",
        task,
      },
      { status: 409 },
    );
  }

  // Read the photo bytes through the one photo helper and inline them as
  // data URLs (the SAM docs accept a base64 data URL as image_url).
  const photos: { photo: (typeof task.photos)[number]; dataUrl: string }[] = [];
  for (const photo of task.photos) {
    const stored = await readPhoto(photo.name);
    if (!stored) {
      return NextResponse.json(
        {
          error:
            "A saved photo file is missing, so the check cannot run. Please delete it and add the photo again.",
          task,
        },
        { status: 409 },
      );
    }
    photos.push({
      photo,
      dataUrl: `data:${stored.contentType};base64,${stored.bytes.toString("base64")}`,
    });
  }

  let aiCheck: TaskAiCheck;
  if (!process.env.MODEL_API_KEY) {
    aiCheck = mockAiCheck(task.department);
  } else {
    try {
      aiCheck = await runLivePhotoCheck(task.department, photos);
    } catch (error) {
      // No usable SAM answer (HTTP error, timeout, bad shape): keep the
      // flow working with a clearly marked MOCK result. Never log the key.
      console.error(
        "SAM photo check failed, saving MOCK result:",
        error instanceof Error ? error.message : "unknown error",
      );
      aiCheck = mockAiCheck(task.department);
    }
  }

  const saved = await saveStoredTaskAiCheck(id, aiCheck);
  if (!saved) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ task: saved, aiCheck, mode: aiCheck.mode });
}
