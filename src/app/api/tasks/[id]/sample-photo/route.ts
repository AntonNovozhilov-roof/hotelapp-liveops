import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { addStoredTaskPhoto, getStoredTask } from "@/lib/store";
import { deletePhoto, saveRawPhoto } from "@/lib/photos";
import { getCurrentUser } from "@/lib/auth";
import { appendHistory } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";
import { DEMO_SAMPLE_PHOTOS, readDemoPhoto } from "@/lib/demo-photos";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  if (process.env.DEMO_MODE !== "true") return NextResponse.json({ error: "Sample photos are not available." }, { status: 404 });
  const { id } = await params;
  const task = await getStoredTask(id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  if (user.department !== task.department) return NextResponse.json({ error: "This task belongs to another team." }, { status: 403 });
  if (task.status !== "in_progress") return NextResponse.json({ error: "Photos can only be added to a started task. Press Start first.", task }, { status: 409 });
  const body = (await request.json().catch(() => null)) as { sampleId?: string } | null;
  const sample = DEMO_SAMPLE_PHOTOS.find((s) => s.id === body?.sampleId);
  if (!sample) return NextResponse.json({ error: "Unknown sample photo." }, { status: 400 });
  const bytes = await readDemoPhoto(sample.file);
  const photo = await saveRawPhoto(`${id}-demo-${randomUUID()}.jpg`, bytes);
  const result = await addStoredTaskPhoto(id, photo);
  if (!result.ok) {
    await deletePhoto(photo.name);
    return NextResponse.json({ error: result.reason === "limit_reached" ? "This task already has 3 photos. Delete one first." : "Could not add the photo.", task: result.task }, { status: 409 });
  }
  await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: result.task.room, taskId: result.task.id, taskTitle: result.task.title, taskType: result.task.type, action: "Photo added", details: `Photo added by ${user.name}.` });
  return NextResponse.json({ task: result.task, photo }, { status: 201 });
}
