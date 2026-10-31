import { NextResponse } from "next/server";
import { getStoredTask, saveAiCheckOutcome } from "@/lib/store";
import { readPhoto } from "@/lib/photos";
import { compareWithReference, mockAiCheck, runLivePhotoCheck, verdictFor } from "@/lib/photo-check";
import type { TaskAiCheck } from "@/lib/tasks";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData } from "@/lib/hotel-data";

/**
 * POST /api/tasks/[id]/ai-check — SAM 3.1 photo check (M5) + perfect
 * reference comparison (P1). With an active room reference, all cleaner
 * photos are compared with it; without one, the simple check runs.
 * Retry/auto rules live in saveAiCheckOutcome (src/lib/store.ts):
 * 1st "different" = retake only, 2nd = auto review flagged, sure pass +
 * owner auto-approve setting = Done. AI never rejects alone.
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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to do this." },
      { status: 401 },
    );
  }
  if (user.department !== task.department) {
    return NextResponse.json(
      {
        error: "This task belongs to another team. You can only work on your own team's tasks.",
        task,
      },
      { status: 403 },
    );
  }
  if (task.type !== "cleaning") {
    return NextResponse.json(
      {
        error: `The AI photo check is only for cleaning tasks. This is a ${task.type} task, so no AI check is needed.`,
        task,
      },
      { status: 409 },
    );
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

  const hotel = await getHotelData();
  const room = hotel.rooms.find((r) => r.number === task.room) ?? null;
  const reference = room?.reference ?? null;

  let aiCheck: TaskAiCheck;
  if (!process.env.MODEL_API_KEY) {
    aiCheck = reference
      ? { ...mockAiCheck(task.department), comparedToReference: true }
      : mockAiCheck(task.department);
  } else {
    try {
      aiCheck = reference
        ? await compareWithReference(photos.map((p) => p.dataUrl), reference.items)
        : await runLivePhotoCheck(task.department, photos);
    } catch (error) {
      console.error(
        "SAM photo check failed, saving MOCK result:",
        error instanceof Error ? error.message : "unknown error",
      );
      aiCheck = reference
        ? { ...mockAiCheck(task.department), comparedToReference: true }
        : mockAiCheck(task.department);
    }
  }
  if (!aiCheck.verdict) {
    aiCheck = { ...aiCheck, verdict: verdictFor(aiCheck.checks).verdict };
  }

  const result = await saveAiCheckOutcome(id, aiCheck, hotel.settings.autoApproveCleaning);
  if (!result) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({
    task: result.task,
    aiCheck,
    mode: aiCheck.mode,
    outcome: result.outcome,
    hasReference: Boolean(reference),
  });
}
