import { NextResponse } from "next/server";
import { getStoredTask } from "@/lib/store";
import { getCheckProgress } from "@/lib/photo-check";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/tasks/[id]/ai-check/progress — live SAM progress (PC1 part 3)
 * for the staff screen: { done, total, elapsedSeconds } or null.
 */
export async function GET(
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
      { error: "This task belongs to another team." },
      { status: 403 },
    );
  }
  const progress = getCheckProgress(id);
  return NextResponse.json({
    progress: progress
      ? {
          done: progress.done,
          total: progress.total,
          elapsedSeconds: Math.max(
            0,
            Math.round((Date.now() - progress.startedAt) / 1000),
          ),
        }
      : null,
  });
}
