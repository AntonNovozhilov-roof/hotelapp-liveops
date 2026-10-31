import { NextResponse } from "next/server";
import {
  clearStoredTasks,
  createCleaningTask,
  listStoredTasks,
} from "@/lib/store";
import { sortTasks } from "@/lib/tasks";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
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
  return NextResponse.json({ task }, { status: 201 });
}

/** Reset demo data: Owner only (D2). The server checks, not just the page. */
export async function DELETE() {
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
  const cleared = await clearStoredTasks();
  return NextResponse.json({ ok: true, cleared });
}
