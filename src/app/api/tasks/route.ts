import { NextResponse } from "next/server";
import { clearStoredTasks, listStoredTasks } from "@/lib/store";
import { sortTasks } from "@/lib/tasks";

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

export async function DELETE() {
  const cleared = await clearStoredTasks();
  return NextResponse.json({ ok: true, cleared });
}
