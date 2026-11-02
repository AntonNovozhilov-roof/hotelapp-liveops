import { NextResponse } from "next/server";
import {
  clearStoredTasks,
  createCleaningTask,
  listStoredTasks,
} from "@/lib/store";
import { sortTasks } from "@/lib/tasks";
import { getCurrentUser } from "@/lib/auth";
import { appendHistory, clearHistory } from "@/lib/history";
import { clearHotelData } from "@/lib/hotel-data";
import { clearReports } from "@/lib/reports-store";
import { isDemoResetAllowed } from "@/lib/security";

/**
 * Tasks are staff data (SEC1): sign-in required. Staff only ever see their
 * own department (asking for another one is 403); Owner/Supervisor see all.
 * Guests never use this route — they use GET /api/guest/tasks.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const room = searchParams.get("room") ?? undefined;
  const department = searchParams.get("department") ?? undefined;
  const idsParam = searchParams.get("ids");
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 50)
    : undefined;

  if (user.department) {
    if (department && department !== user.department) {
      return NextResponse.json(
        { error: "This belongs to another team. You can only see your own team's tasks." },
        { status: 403 },
      );
    }
    if (ids?.length) {
      const requested = await listStoredTasks({ ids });
      if (requested.some((task) => task.department !== user.department)) {
        return NextResponse.json(
          { error: "This belongs to another team. You can only see your own team's tasks." },
          { status: 403 },
        );
      }
    }
    const tasks = sortTasks(await listStoredTasks({ room, department: user.department, ids }));
    return NextResponse.json({ tasks });
  }

  const tasks = sortTasks(await listStoredTasks({ room, department, ids }));
  return NextResponse.json({ tasks });
}

/**
 * Create a "Clean room <number>" cleaning task (T1).
 * Supervisor or Owner only — the server checks, not just the page.
 * Body: {"room":"204"}
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to do this." },
      { status: 401 },
    );
  }
  if (user.role !== "supervisor" && user.role !== "owner") {
    return NextResponse.json(
      { error: "Only a supervisor or the Owner can create a cleaning task." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const record = (body ?? {}) as Record<string, unknown>;
  const room =
    typeof record.room === "string" ? record.room.trim().slice(0, 20) : "";
  if (!room) {
    return NextResponse.json(
      { error: "Please write a room number, for example 204." },
      { status: 400 },
    );
  }

  const task = await createCleaningTask(room);
  await appendHistory({ actorName: user.name, actorRole: user.roleLabel, room: task.room, taskId: task.id, taskTitle: task.title, taskType: task.type, action: "Task created", details: `${user.name} created this cleaning task.` });
  return NextResponse.json({ task }, { status: 201 });
}

/** Reset demo data: Owner only (D2) and only when ALLOW_DEMO_RESET=true (SEC1). */
export async function DELETE() {
  if (!isDemoResetAllowed()) {
    return NextResponse.json(
      { error: "Reset demo data is turned off on this copy." },
      { status: 403 },
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to do this." },
      { status: 401 },
    );
  }
  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the Owner can reset demo data." },
      { status: 403 },
    );
  }
  // Full demo reset (H1): tasks + photos, rooms + hotel info, history, reports.
  const cleared = await clearStoredTasks();
  await clearHotelData();
  await clearHistory();
  await clearReports();
  return NextResponse.json({ ok: true, cleared });
}
