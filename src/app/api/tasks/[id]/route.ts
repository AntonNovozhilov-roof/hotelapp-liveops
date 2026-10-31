import { NextResponse } from "next/server";
import { updateStoredTaskStatus } from "@/lib/store";
import { FLOW_TEXT, TASK_STATUSES, type TaskStatus } from "@/lib/tasks";

const ACTION_TO_STATUS: Record<string, TaskStatus> = {
  accept: "accepted",
  start: "in_progress",
  send_to_review: "review",
  review: "review",
  approve: "done",
  send_back: "in_progress",
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
  const action = typeof record.action === "string" ? record.action : undefined;
  const requested =
    typeof record.status === "string"
      ? record.status
      : action
        ? ACTION_TO_STATUS[action]
        : undefined;
  const note =
    typeof record.note === "string"
      ? record.note
      : typeof record.reviewNote === "string"
        ? record.reviewNote
        : undefined;

  if (!requested || !TASK_STATUSES.includes(requested as TaskStatus)) {
    return NextResponse.json(
      {
        error: `Please send the next status or action. Flow: ${FLOW_TEXT}. Actions: accept, start, send_to_review, approve, send_back (send_back needs {"note":"..."}).`,
      },
      { status: 400 },
    );
  }

  if (action === "send_back" && !(note && note.trim())) {
    return NextResponse.json(
      { error: "Please add a short note when sending a task back." },
      { status: 400 },
    );
  }

  const result = await updateStoredTaskStatus(
    id,
    requested as TaskStatus,
    note,
  );

  if (!result.ok && result.reason === "not_found") {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!result.ok && result.reason === "photo_required") {
    return NextResponse.json(
      {
        error: "Add at least 1 photo before sending this task to review.",
        task: result.task,
      },
      { status: 409 },
    );
  }
  if (!result.ok && result.reason === "note_required") {
    return NextResponse.json(
      {
        error: "Please add a short note when sending a task back.",
        task: result.task,
      },
      { status: 400 },
    );
  }
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Cannot move this task to "${requested}" from its current status. Flow: ${FLOW_TEXT}.`,
        task: result.task,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ task: result.task });
}
