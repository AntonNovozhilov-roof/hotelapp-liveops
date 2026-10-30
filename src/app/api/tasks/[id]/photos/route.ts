import { NextResponse } from "next/server";
import {
  addStoredTaskPhoto,
  getStoredTask,
  removeStoredTaskPhoto,
} from "@/lib/store";
import {
  MAX_PHOTO_BYTES,
  deletePhoto,
  isSupportedPhotoType,
  savePhoto,
} from "@/lib/photos";

const NOT_STARTED_MESSAGE =
  "Photos can only be added to a started task. Press Start first.";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const task = await getStoredTask(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "in_progress") {
    return NextResponse.json(
      { error: NOT_STARTED_MESSAGE, task },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Please send the photo as form data (field name: photo)." },
      { status: 400 },
    );
  }

  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "No photo received. Please choose a photo and try again." },
      { status: 400 },
    );
  }
  if (!isSupportedPhotoType(file.type)) {
    return NextResponse.json(
      {
        error:
          "That file is not a photo. Please send a JPG, PNG, WEBP, GIF or HEIC photo.",
      },
      { status: 415 },
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: "That photo is too big (max 10 MB). Please try again." },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const photo = await savePhoto(id, bytes, file.type);

  const result = await addStoredTaskPhoto(id, photo);
  if (!result.ok) {
    // The task changed while we saved (or the limit was hit): remove the file.
    await deletePhoto(photo.name);
    if (result.reason === "limit_reached") {
      return NextResponse.json(
        {
          error: "This task already has 3 photos. Delete one first.",
          task: result.task,
        },
        { status: 409 },
      );
    }
    if (result.reason === "not_started") {
      return NextResponse.json(
        { error: NOT_STARTED_MESSAGE, task: result.task },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ task: result.task, photo }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const name = new URL(request.url).searchParams.get("name") ?? "";

  const result = await removeStoredTaskPhoto(id, name);
  if (!result.ok && result.reason === "not_found") {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: "Photo not found on this task.", task: result.task },
      { status: 404 },
    );
  }

  await deletePhoto(name);
  return NextResponse.json({ task: result.task });
}
