import { NextResponse } from "next/server";
import { updateStoredTaskStatus } from "@/lib/store";
import { TASK_STATUSES, type TaskStatus } from "@/lib/tasks";

const ACTION_TO_STATUS: Record<string, TaskStatus> = {
  accept: "accepted",
  start: "in_progress",
  done: "done",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const requested =
    typeof record.status === "string"
      ? record.status
      : typeof record.action === "string"
        ? ACTION_TO_STATUS[record.action]
        : undefined;

  if (!requested || !TASK_STATUSES.includes(requested as TaskStatus)) {
    return NextResponse.json(
      {
        error:
          "Please send the next status, e.g. {\"status\":\"accepted\"}. Flow: New -> Accepted -> In progress -> Done.",
      },
      { status: 400 },
    );
  }

  const result = await updateStoredTaskStatus(id, requested as TaskStatus);

  if (!result.ok && result.reason === "not_found") {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Cannot move this task to "${requested}" from its current status. Flow: New -> Accepted -> In progress -> Done.`,
        task: result.task,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ task: result.task });
}
