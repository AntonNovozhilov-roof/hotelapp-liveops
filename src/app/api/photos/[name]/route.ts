import { NextResponse } from "next/server";
import { readPhoto } from "@/lib/photos";
import { getCurrentUser } from "@/lib/auth";
import { listStoredTasks } from "@/lib/store";
import { getHotelData } from "@/lib/hotel-data";

/**
 * Serve one saved photo (SEC1): sign-in required, guests never get photos.
 * Staff may only open photos on tasks of their own department; perfect-room
 * reference photos and everything else are Owner/Supervisor only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  }
  const { name } = await params;

  if (user.role !== "owner" && user.role !== "supervisor") {
    const tasks = await listStoredTasks();
    const task = tasks.find((t) => t.photos.some((p) => p.name === name));
    if (!task) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    if (!user.department || task.department !== user.department) {
      return NextResponse.json(
        { error: "This photo belongs to another team's task." },
        { status: 403 },
      );
    }
  } else {
    // Owner/Supervisor: still 404 for names that belong to nothing.
    const tasks = await listStoredTasks();
    const onTask = tasks.some((t) => t.photos.some((p) => p.name === name));
    if (!onTask) {
      const hotel = await getHotelData();
      const onReference = hotel.rooms.some((room) =>
        [room.reference, room.pendingReference, ...room.referenceHistory].some(
          (ref) => ref?.photos.some((p) => p.name === name),
        ),
      );
      if (!onReference) {
        return NextResponse.json({ error: "Photo not found" }, { status: 404 });
      }
    }
  }

  const photo = await readPhoto(name);
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Length": String(photo.bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
