import { NextResponse } from "next/server";
import { clearStoredTasks, listStoredTasks } from "@/lib/store";
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
