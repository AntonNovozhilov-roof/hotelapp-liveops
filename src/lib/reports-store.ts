import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ReportKind, ReportPoint, ReportSource } from "./reports";

/** Saved reports (.data/reports.json, like tasks/history). Old reports stay listed. */
export interface SavedReport {
  id: string; kind: ReportKind; createdAt: string; periodLabel: string;
  source: ReportSource; model: string | null; numbersChecked: boolean;
  includesSample: boolean; points: ReportPoint[]; text: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "reports.json");
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(work: () => Promise<T>): Promise<T> { const run = queue.then(work, work); queue = run.then(() => undefined, () => undefined); return run; }

async function readAll(): Promise<SavedReport[]> {
  try { const p = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as unknown; return Array.isArray(p) ? (p as SavedReport[]).filter((r) => r && typeof r.id === "string") : []; } catch { return []; }
}
async function writeAll(reports: SavedReport[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
  await fs.rename(tmp, DATA_FILE);
}
export async function listReports(): Promise<SavedReport[]> {
  return (await readAll()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export async function saveReport(report: Omit<SavedReport, "id" | "createdAt">): Promise<SavedReport> {
  return withLock(async () => {
    const saved: SavedReport = { ...report, id: randomUUID(), createdAt: new Date().toISOString() };
    const all = await readAll(); all.push(saved); await writeAll(all); return saved;
  });
}
