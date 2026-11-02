import { NextResponse } from "next/server";
import { getStoredTask, saveAiCheckOutcome } from "@/lib/store";
import { readPhotoDataUrl } from "@/lib/photos";
import { beginCheckProgress, compareWithReference, endCheckProgress, fuseWithSpark, mockAiCheck, runLivePhotoCheck, runSecondOpinion, updateCheckProgress, verdictFor } from "@/lib/photo-check";
import type { TaskAiCheck } from "@/lib/tasks";
import { getCurrentUser } from "@/lib/auth";
import { getHotelData } from "@/lib/hotel-data";
import { appendHistory } from "@/lib/history";
import { consumeAiCall } from "@/lib/security";
import { foreignOriginResponse } from "@/lib/security";

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
  const foreignOrigin = foreignOriginResponse(_request);
  if (foreignOrigin) return foreignOrigin;
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
  const hotelEarly = await getHotelData();
  if (!hotelEarly.settings.aiPhotoCheckEnabled) {
    return NextResponse.json(
      { error: "The AI photo check is turned off by the Owner. Add a photo if needed, then send the task to review.", task },
      { status: 409 },
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
    const dataUrl = await readPhotoDataUrl(photo.name);
    if (!dataUrl) {
      return NextResponse.json(
        {
          error:
            "A saved photo file is missing, so the check cannot run. Please delete it and add the photo again.",
          task,
        },
        { status: 409 },
      );
    }
    photos.push({ photo, dataUrl });
  }

  const hotel = await getHotelData();
  const room = hotel.rooms.find((r) => r.number === task.room) ?? null;
  const reference = room?.reference ?? null;

  let aiCheck: TaskAiCheck;
  // Daily AI cap (SEC1): over the cap the check is a marked MOCK.
  if (!process.env.MODEL_API_KEY || !consumeAiCall("photo check")) {
    aiCheck = reference
      ? { ...mockAiCheck(task.department), comparedToReference: true }
      : mockAiCheck(task.department);
  } else {
    beginCheckProgress(id);
    try {
      const onProgress = (done: number, total: number) =>
        updateCheckProgress(id, done, total);
      aiCheck = reference
        ? await compareWithReference(photos.map((p) => p.dataUrl), reference.items, onProgress)
        : await runLivePhotoCheck(task.department, photos, onProgress);
    } catch (error) {
      endCheckProgress(id);
      // PC1: a failed LIVE check is NOT saved as a fake MOCK success.
      // Nothing is saved; the cleaner sees "Try again" and can retry.
      console.error(
        "SAM photo check failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return NextResponse.json(
        {
          error: "The AI couldn't check this photo right now. Try again.",
          task,
        },
        { status: 503 },
      );
    }
    // PC1 second opinion: one Spark call per check, then fuse verdicts.
    // Spark failing/unparseable -> "AI not sure", never a pass.
    const perfectDataUrls: string[] = [];
    if (reference) {
      for (const photo of reference.photos) {
        const url = await readPhotoDataUrl(photo.name);
        if (url) perfectDataUrls.push(url);
      }
    }
    const spark = await runSecondOpinion(
      perfectDataUrls,
      photos.map((p) => p.dataUrl),
    );
    aiCheck = fuseWithSpark(aiCheck, spark);
    endCheckProgress(id);
  }
  if (!aiCheck.verdict) {
    aiCheck = { ...aiCheck, verdict: verdictFor(aiCheck.checks).verdict };
  }

  const result = await saveAiCheckOutcome(id, aiCheck, hotel.settings.aiPhotoCheckEnabled && hotel.settings.autoApproveCleaning);
  if (!result) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const verdictWord = aiCheck.verdict === "ready" ? "Looks ready" : aiCheck.verdict === "different" ? "Different from perfect photo" : "AI not sure";
  await appendHistory({
    actorName: "AI", actorRole: "AI", room: result.task.room, taskId: result.task.id, taskTitle: result.task.title, taskType: result.task.type,
    action: "AI check", details: `AI check: ${verdictWord}.`,
    ai: { verdict: aiCheck.verdict ?? null, score: aiCheck.score, model: aiCheck.model, mode: aiCheck.mode, checks: aiCheck.checks, spark: aiCheck.spark ?? null },
  });
  if (result.outcome === "review") {
    await appendHistory({ actorName: "AI", actorRole: "AI", room: result.task.room, taskId: result.task.id, taskTitle: result.task.title, taskType: result.task.type, action: "Sent to review", details: "Failed AI check twice — sent to review automatically for a supervisor to decide." });
  }
  if (result.outcome === "done_auto") {
    await appendHistory({ actorName: "AI", actorRole: "AI", room: result.task.room, taskId: result.task.id, taskTitle: result.task.title, taskType: result.task.type, action: "Approved", details: "Auto-approved by AI (owner setting)." });
    await appendHistory({ actorName: "AI", actorRole: "AI", room: result.task.room, taskId: result.task.id, taskTitle: result.task.title, taskType: result.task.type, action: "Done", details: "Task is done." });
  }

  return NextResponse.json({
    task: result.task,
    aiCheck,
    mode: aiCheck.mode,
    outcome: result.outcome,
    hasReference: Boolean(reference),
  });
}
