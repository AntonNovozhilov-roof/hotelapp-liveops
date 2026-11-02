import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listStoredTasks } from "@/lib/store";
import { GUEST_COOKIE, guestDataFromToken } from "@/lib/security";

/**
 * Guest task statuses (SEC1): the only task data a guest can read.
 * Proof is the signed httpOnly guest cookie issued by POST /api/guest/message
 * when the guest's message created tasks. Returns ONLY id, title and status
 * for those tasks — no photos, no other rooms, no other guests' tasks.
 */
export async function GET() {
  const store = await cookies();
  const guest = guestDataFromToken(store.get(GUEST_COOKIE)?.value);
  if (!guest || guest.taskIds.length === 0) {
    return NextResponse.json({ tasks: [] });
  }
  const tasks = await listStoredTasks({ ids: guest.taskIds, room: guest.room });
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = guest.taskIds
    .map((id) => byId.get(id))
    .filter((task): task is NonNullable<typeof task> => Boolean(task))
    .map((task) => ({ id: task.id, title: task.title, status: task.status }));
  return NextResponse.json({ tasks: ordered });
}
