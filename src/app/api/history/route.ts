import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listHistory, type HistoryFilter } from "@/lib/history";

/** History is for the Owner and Supervisor only (M9) — server-checked. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to do this." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "supervisor") {
    return NextResponse.json(
      { error: "Only the Owner or Supervisor can see the history." },
      { status: 403 },
    );
  }
  const sp = new URL(request.url).searchParams;
  const rangeRaw = sp.get("range");
  const filter: HistoryFilter = {
    taskId: sp.get("task") ?? undefined,
    room: sp.get("room") ?? undefined,
    person: sp.get("person") ?? undefined,
    taskType: sp.get("type") ?? undefined,
    range: rangeRaw === "today" || rangeRaw === "7d" ? rangeRaw : "all",
    search: sp.get("q") ?? undefined,
    limit: 500,
  };
  const events = await listHistory(filter);
  // AI item details are for the system only: strip the checks from the API.
  const safe = events.map(({ ai, ...rest }) => ({
    ...rest,
    ai: ai ? { verdict: ai.verdict, score: ai.score, model: ai.model, mode: ai.mode } : null,
  }));
  return NextResponse.json({ events: safe });
}
