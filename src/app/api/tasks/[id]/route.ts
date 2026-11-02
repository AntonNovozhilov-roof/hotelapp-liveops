import { NextResponse } from "next/server";
import { getStoredTask, updateStoredTaskStatus } from "@/lib/store";
import { FLOW_TEXT, TASK_STATUSES, type TaskStatus } from "@/lib/tasks";
import { getCurrentUser } from "@/lib/auth";
import { appendHistory } from "@/lib/history";
import { foreignOriginResponse } from "@/lib/security";

const ACTION_TO_STATUS: Record<string, TaskStatus> = {
  accept: "accepted",
  start: "in_progress",
  send_to_review: "review",
  review: "review",
  finish: "done",
  approve: "done",
  send_back: "in_progress",
  reopen: "in_progress",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
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
        error: `Please send the next status or action. Flow: ${FLOW_TEXT}. Actions: accept, start, finish, send_to_review, approve, send_back, reopen (send_back/reopen need {"note":"..."}).`,
      },
      { status: 400 },
    );
  }

  // Server role check (D2 + T1 + M7): who is signed in decides what is
  // allowed, never the page. Approve / send back / reopen = supervisor, or
  // the Owner acting as supervisor (small hotels). The staff steps
  // (accept, start, finish, send to review) = own team only.
  // A staff "done" from in_progress (request/repair) is NOT supervisor work;
  // only "done" from review (approve) is.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to do this." },
      { status: 401 },
    );
  }
  const task = await getStoredTask(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  const isSupervisorAction =
    action === "approve" ||
    action === "send_back" ||
    action === "reopen" ||
    (task.status === "review" &&
      (requested === "done" || requested === "in_progress")) ||
    (task.status === "done" && requested === "in_progress");
  if (
    isSupervisorAction &&
    user.role !== "supervisor" &&
    user.role !== "owner"
  ) {
    return NextResponse.json(
      {
        error:
          action === "reopen" ||
          (task.status === "done" && requested === "in_progress")
            ? "Only a supervisor or the Owner can reopen a task."
            : "Only a supervisor or the Owner can approve or send back a task.",
        task,
      },
      { status: 403 },
    );
  }
  if (!isSupervisorAction && user.department !== task.department) {
    return NextResponse.json(
      {
        error:
          user.role === "supervisor" || user.role === "owner"
            ? "This step is done by the staff team. A supervisor only approves or sends back tasks in review."
            : "This task belongs to another team. You can only work on your own team's tasks.",
        task,
      },
      { status: 403 },
    );
  }

  if (
    (action === "send_back" || action === "reopen") &&
    !(note && note.trim())
  ) {
    return NextResponse.json(
      {
        error:
          action === "reopen"
            ? "Please add a short note when reopening a task."
            : "Please add a short note when sending a task back.",
      },
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
        error:
          result.task?.type === "repair"
            ? "Add a proof photo before finishing this repair."
            : "Add at least 1 photo before sending this task to review.",
        task: result.task,
      },
      { status: 409 },
    );
  }
  if (!result.ok && result.reason === "ai_check_required") {
    return NextResponse.json(
      {
        error:
          "Run the AI photo check before sending this cleaning task to review.",
        task: result.task,
      },
      { status: 409 },
    );
  }
  if (!result.ok && result.reason === "ai_check_failed") {
    return NextResponse.json(
      {
        error:
          "Not ready yet. The room looks different from the perfect photo. Check the room and take new photos.",
        task: result.task,
      },
      { status: 409 },
    );
  }
  if (!result.ok && result.reason === "note_required") {
    return NextResponse.json(
      {
        error:
          action === "reopen"
            ? "Please add a short note when reopening a task."
            : "Please add a short note when sending a task back.",
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

  const t = result.task;
  const base = { actorName: user.name, actorRole: user.roleLabel, room: t.room, taskId: t.id, taskTitle: t.title, taskType: t.type };
  if (action === "approve" || (task.status === "review" && requested === "done")) {
    await appendHistory({ ...base, action: "Approved", details: `Approved by ${user.name}.` });
    await appendHistory({ ...base, action: "Done", details: "Task is done." });
  } else if (action === "send_back" || (task.status === "review" && requested === "in_progress")) {
    await appendHistory({ ...base, action: "Sent back", details: `Sent back by ${user.name}: ${note ?? ""}`.trim() });
  } else if (action === "reopen" || (task.status === "done" && requested === "in_progress")) {
    await appendHistory({ ...base, action: "Reopened", details: `Reopened by ${user.name}: ${note ?? ""}`.trim() });
  } else if (requested === "accepted") {
    await appendHistory({ ...base, action: "Accepted", details: `Accepted by ${user.name}.` });
  } else if (requested === "in_progress") {
    await appendHistory({ ...base, action: "Started", details: `Started by ${user.name}.` });
  } else if (requested === "review") {
    await appendHistory({ ...base, action: "Sent to review", details: `Sent to review by ${user.name}.` });
  } else if (requested === "done") {
    await appendHistory({ ...base, action: "Done", details: `Finished by ${user.name}.` });
  }

  return NextResponse.json({ task: result.task });
}
