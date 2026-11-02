import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listStoredTasks } from "@/lib/store";
import { listHistory } from "@/lib/history";
import { getHotelData } from "@/lib/hotel-data";
import { buildPlainReport, computeReportFacts, factsForPrompt, verifyReportText, type ReportKind, type ReportPoint, type ReportSource } from "@/lib/reports";
import { listReports, saveReport } from "@/lib/reports-store";
import { consumeAiCall } from "@/lib/security";
import { foreignOriginResponse } from "@/lib/security";

/**
 * Reports API (M10/S6). Owner + Supervisor only — staff get 403.
 * Model: Muse Wonder — official Meta docs (dev.meta.ai/docs/models):
 * model id `muse-wonder-1.0`, POST https://api.meta.ai/v1/chat/completions
 * (same Chat Completions format as muse-spark-1.3), Bearer MODEL_API_KEY.
 */
const MODEL_BASE_URL = "https://api.meta.ai/v1";
const REPORT_MODEL = "muse-wonder-1.0";

const DAILY_SECTIONS = ["What needs attention today", "Key numbers", "Rooms and bookings", "Cleaning and repairs", "Guest questions"];
const WEEKLY_SECTIONS = ["What went well", "What went wrong", "Patterns", "Staff workload", "Rooms and bookings", "Suggestions", "Guest questions"];

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in to do this." }, { status: 401 }) };
  if (user.role !== "owner" && user.role !== "supervisor") return { error: NextResponse.json({ error: "Only the Owner or Supervisor can see reports." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const g = await guard(); if ("error" in g) return g.error;
  return NextResponse.json({ reports: await listReports() });
}

function cleanPoints(raw: unknown, kind: ReportKind, validIds: Set<string>): ReportPoint[] {
  if (!Array.isArray(raw)) return [];
  const allowed = kind === "daily" ? DAILY_SECTIONS : WEEKLY_SECTIONS;
  return raw.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    const text = typeof r.text === "string" ? r.text.trim().slice(0, 600) : "";
    if (!text) return [];
    const section = typeof r.section === "string" && allowed.includes(r.section) ? r.section : allowed[0];
    const taskIds = Array.isArray(r.taskIds) ? r.taskIds.filter((id): id is string => typeof id === "string" && validIds.has(id)).slice(0, 10) : [];
    return [{ section, text, taskIds }];
  }).slice(0, kind === "daily" ? 6 : 12);
}

async function askWonder(kind: ReportKind, factsJson: string, badNumbers: number[] | null): Promise<ReportPoint[]> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");
  const daily = kind === "daily";
  const res = await fetch(`${MODEL_BASE_URL}/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: REPORT_MODEL, temperature: 0.2, messages: [
      { role: "system", content: "You write short, plain hotel reports for the owner. Return ONLY JSON, no markdown." },
      { role: "user", content: `Write a ${daily ? "DAILY report (yesterday + today so far): 3-5 points, most important first — what needs attention today, then key numbers" : "WEEKLY report (last 7 days): what went well, what went wrong, patterns, staff workload, and exactly 3 points in section Suggestions with concrete actions"}.
Use ONLY the numbers in allowedNumbers below — copy them exactly. Never invent a number. Use minutes for times. Do not write dates or years. Every point must list the taskIds it is about (from the facts; [] only when no task fits).
Sections must be exactly: ${daily ? DAILY_SECTIONS.join(" | ") : WEEKLY_SECTIONS.join(" | ")}.
Return: {"points":[{"section":"...","text":"one or two short sentences","taskIds":["..."]}]}
${badNumbers ? `Your last try used wrong numbers (${badNumbers.join(", ")}). Use only allowedNumbers this time.` : ""}
FACTS (the only source — no guest personal data is included):
${factsJson}` },
    ] }),
  });
  if (!res.ok) throw new Error(`Model API returned HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = data.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => (p && typeof p === "object" && "text" in p ? String((p as { text?: unknown }).text ?? "") : "")).join("") : "";
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  const parsed = JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned) as { points?: unknown };
  return (parsed.points ?? []) as ReportPoint[];
}

export async function POST(request: Request) {
  const foreignOrigin = foreignOriginResponse(request);
  if (foreignOrigin) return foreignOrigin;
  const g = await guard(); if ("error" in g) return g.error;
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* default daily */ }
  const kind: ReportKind = body.kind === "weekly" ? "weekly" : "daily";

  const { listBookings } = await import("@/lib/bookings");
  const [tasks, history, hotel, bookings] = await Promise.all([listStoredTasks(), listHistory({ range: "all", limit: 5000 }), getHotelData(), listBookings()]);
  const facts = computeReportFacts(kind, tasks, history, hotel.rooms, new Date(), bookings, hotel.settings.currency);
  const validIds = new Set(facts.taskIds);
  const plain = buildPlainReport(facts);
  const breakNumbers = process.env.REPORT_TEST_BREAK_NUMBERS === "1"; // test-only hook: proves the fallback works

  let points: ReportPoint[]; let source: ReportSource; let model: string | null = null;
  // Daily AI cap (SEC1): over the cap the report is a marked MOCK.
  if (!process.env.MODEL_API_KEY || !consumeAiCall("owner report")) {
    points = plain; source = "mock";
  } else {
    try {
      let bad: number[] | null = null; let ok = false; points = plain;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        let raw = await askWonder(kind, factsForPrompt(facts), bad);
        if (breakNumbers && raw.length) raw = raw.map((p, i) => (i === 0 ? { ...p, text: `${p.text} There are 9999 open tasks.` } : p));
        const cleaned = cleanPoints(raw, kind, validIds);
        if (!cleaned.length) throw new Error("Model returned no points");
        const check = verifyReportText(cleaned.map((p) => p.text), facts);
        if (check.ok && cleaned.length >= 3) { points = cleaned; ok = true; } else { bad = check.bad.length ? check.bad : [9999]; }
      }
      if (ok) {
        // Completeness: weekly must cover workload + exactly 3 suggestions; fill any gap from the plain facts report.
        if (kind === "weekly") {
          const have = new Set(points.map((p) => p.section));
          for (const section of ["What went well", "What went wrong", "Patterns", "Staff workload", "Rooms and bookings"]) {
            if (!have.has(section)) points.push(...plain.filter((p) => p.section === section));
          }
          const sugg = points.filter((p) => p.section === "Suggestions");
          if (sugg.length < 3) points.push(...plain.filter((p) => p.section === "Suggestions").slice(0, 3 - sugg.length));
          const by = (s: string) => points.filter((p) => p.section === s);
          points = [...by("What went well").slice(0, 1), ...by("What went wrong").slice(0, 3), ...by("Patterns").slice(0, 2), ...by("Staff workload").slice(0, 1), ...by("Suggestions").slice(0, 3), ...points.filter((p) => !["What went well", "What went wrong", "Patterns", "Staff workload", "Suggestions"].includes(p.section))].slice(0, 11);
        }
        source = "ai"; model = REPORT_MODEL;
      } else { points = plain; source = "fallback"; }
    } catch (error) {
      console.error("Report model call failed:", error instanceof Error ? error.message : "unknown error");
      points = plain; source = "mock";
    }
  }
  const checked = verifyReportText(points.map((p) => p.text), facts).ok;
  const text = points.map((p) => `${p.section}\n${p.text}`).join("\n\n");
  const report = await saveReport({ kind, periodLabel: facts.periodLabel, source, model, numbersChecked: checked, includesSample: facts.includesSample, points, text });
  return NextResponse.json({ report, facts: { created: facts.created, done: facts.done, open: facts.open, urgentOpen: facts.urgentOpen } });
}
