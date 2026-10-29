import { NextResponse } from "next/server";
import { listStoredTasks } from "@/lib/store";
import { sortTasks } from "@/lib/tasks";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get("room") ?? undefined;
  const department = searchParams.get("department") ?? undefined;

  const tasks = sortTasks(await listStoredTasks({ room, department }));
  return NextResponse.json({ tasks });
}
