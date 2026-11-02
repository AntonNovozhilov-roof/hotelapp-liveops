"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Empty } from "@/components/ui";
import type { SavedReport } from "@/lib/reports-store";
import type { StoredTask } from "@/lib/tasks";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtWhen(iso: string): string { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

export default function ReportsBoard({ initialReports, isOwner, initialSampleCount }: { initialReports: SavedReport[]; isOwner: boolean; initialSampleCount: number }) {
  const [kind, setKind] = useState<"daily" | "weekly">("daily");
  const [reports, setReports] = useState(initialReports);
  const [selectedId, setSelectedId] = useState<string | null>(initialReports[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPoint, setOpenPoint] = useState<number | null>(null);
  const [pointTasks, setPointTasks] = useState<Record<number, StoredTask[]>>({});
  const [sampleCount, setSampleCount] = useState(initialSampleCount);
  const autoTried = useRef(false);

  const selected = reports.find((r) => r.id === selectedId && r.kind === kind) ?? reports.find((r) => r.kind === kind) ?? null;

  const generate = useCallback(async (k: "daily" | "weekly", quiet = false) => {
    setBusy(true); setError(null); if (!quiet) setMsg(null);
    try {
      const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: k }) });
      const data = (await res.json()) as { report?: SavedReport; error?: string };
      if (!res.ok || !data.report) throw new Error(data.error ?? "Could not make the report. Please try again.");
      setReports((prev) => [data.report as SavedReport, ...prev]); setSelectedId(data.report.id); setOpenPoint(null);
      setMsg(k === "daily" ? "Daily report ready." : "Weekly report ready.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not make the report. Please try again."); }
    finally { setBusy(false); }
  }, []);

  // Daily auto-creates on first open after 07:00 that day.
  useEffect(() => {
    if (autoTried.current) return; autoTried.current = true;
    const now = new Date();
    const hasToday = initialReports.some((r) => r.kind === "daily" && new Date(r.createdAt).toDateString() === now.toDateString());
    if (now.getHours() >= 7 && !hasToday) void generate("daily", true);
  }, [generate, initialReports]);

  async function togglePoint(i: number, taskIds: string[]) {
    if (openPoint === i) { setOpenPoint(null); return; }
    setOpenPoint(i);
    if (!pointTasks[i] && taskIds.length) {
      try { const res = await fetch(`/api/tasks?ids=${taskIds.join(",")}`); const d = (await res.json()) as { tasks?: StoredTask[] }; setPointTasks((p) => ({ ...p, [i]: d.tasks ?? [] })); } catch { setPointTasks((p) => ({ ...p, [i]: [] })); }
    }
  }

  function reportText(r: SavedReport): string {
    return `${r.kind === "daily" ? "Daily" : "Weekly"} report — ${r.periodLabel}\nMade ${new Date(r.createdAt).toLocaleString()}${r.source === "mock" ? "\nMOCK report (no AI answer — built from the facts)" : ""}${r.includesSample ? "\nIncludes sample data" : ""}\n\n${r.points.map((p) => `${p.section}\n${p.text}`).join("\n\n")}`;
  }
  async function copyText() {
    if (!selected) return;
    const text = reportText(selected);
    try { await navigator.clipboard.writeText(text); setMsg("Report copied. You can paste it anywhere."); return; } catch { /* fall back below */ }
    try {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove();
      if (ok) { setMsg("Report copied. You can paste it anywhere."); } else { setError("Copy did not work in this browser. Try Download PDF instead."); }
    } catch { setError("Copy did not work in this browser. Try Download PDF instead."); }
  }
  async function downloadPdf() {
    if (!selected) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    try { const logoRes = await fetch("/brand/readybell-logo.png"); const blob = await logoRes.blob(); const dataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob); }); doc.addImage(dataUrl, "PNG", 14, 10, 42, 8.4); } catch { doc.setFontSize(11); doc.text("Readybell", 14, 16); }
    doc.setFontSize(16); doc.text(`${selected.kind === "daily" ? "Daily" : "Weekly"} report`, 14, 26);
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(reportText(selected), 180) as string[];
    doc.text(lines.slice(1), 14, 36);
    doc.save(`${selected.kind}-report-${selected.createdAt.slice(0, 10)}.pdf`);
    setMsg("PDF downloaded.");
  }
  function downloadMd() { if (!selected) return; const blob = new Blob([reportText(selected)], { type: "text/markdown" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${selected.kind}-report-${selected.createdAt.slice(0, 10)}.md`; a.click(); URL.revokeObjectURL(a.href); }

  async function sample(action: "load" | "remove") {
    if (action === "remove" && !window.confirm("Remove sample data? Only the labelled sample tasks and their history will be deleted. Your real tasks stay.")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/reports/sample", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const d = (await res.json()) as { created?: number; removed?: number; createdBookings?: number; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Sample data change failed.");
      setSampleCount(action === "load" ? (d.created ?? 0) : 0);
      setMsg(action === "load" ? `Sample week loaded (${d.created} sample tasks${d.createdBookings ? ` and ${d.createdBookings} sample bookings` : ""}). Now make a Weekly report to see it.` : `Sample data removed (${d.removed} tasks). Your other tasks were not touched.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Sample data change failed."); } finally { setBusy(false); }
  }

  const old = reports.filter((r) => r.kind === kind);
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report type">
        {(["daily", "weekly"] as const).map((k) => (
          <Button key={k} variant={kind === k ? "primary" : "secondary"} onClick={() => { setKind(k); setOpenPoint(null); }} aria-selected={kind === k} className="min-h-11 flex-1 min-[420px]:flex-none">
            {k === "daily" ? "Daily" : "Weekly"}
          </Button>
        ))}
        <Button variant="secondary" loading={busy} onClick={() => void generate(kind)} className="min-h-11">Regenerate</Button>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">{kind === "daily" ? "Yesterday plus today so far. Made automatically on your first visit after 07:00." : "The last 7 days: what went well, what went wrong, patterns, workload and 3 suggestions."}</p>

      {msg && <p className="mt-3 rounded-lg bg-ready-soft px-3 py-2 text-[13.5px] text-ready-deep" role="status">{msg}</p>}
      {error && <p className="mt-3 rounded-lg bg-dirty-soft px-3 py-2 text-[13.5px] text-dirty-deep" role="alert">{error}</p>}

      {busy && !selected ? <Card className="mt-4"><Empty title="Writing your report…" text="Checking the task facts first, then writing. This can take a few seconds." /></Card>
        : !selected ? (
          <Card className="mt-4"><Empty title={kind === "daily" ? "No daily report yet" : "No weekly report yet"}
            text={kind === "weekly" && sampleCount === 0 && isOwner ? "A weekly report needs a week of tasks. Load the sample week below, then make the report — or wait for real tasks to build up." : "Tap Regenerate and we will build one from the real task facts right now."}
            action={<Button loading={busy} onClick={() => void generate(kind)}>Make my {kind} report</Button>} /></Card>
        ) : (
          <Card className="mt-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold">{selected.kind === "daily" ? "Daily report" : "Weekly report"} · {selected.periodLabel}</h2>
              {selected.source === "mock" && <Badge tone="brass">MOCK report</Badge>}
              {selected.source === "fallback" && <Badge tone="dirty">Plain report — AI numbers did not pass the check</Badge>}
              {selected.numbersChecked && <Badge tone="ready">All numbers checked ✓</Badge>}
              {selected.includesSample && <Badge tone="brass">Includes sample data</Badge>}
              <span className="text-[12.5px] text-ink-3">{fmtWhen(selected.createdAt)}</span>
            </div>
            {selected.source === "mock" && <p className="mt-2 text-[13px] text-ink-3">No AI answer was available, so this report was built straight from the checked facts. Every number below comes from your tasks.</p>}
            <div className="mt-3 space-y-2">
              {selected.points.map((p, i) => (
                <div key={i} className="rounded-lg border border-line">
                  <button type="button" className="flex min-h-11 w-full items-start justify-between gap-3 px-3 py-2.5 text-left" onClick={() => void togglePoint(i, p.taskIds)} aria-expanded={openPoint === i}>
                    <span><span className="block text-[12px] font-semibold uppercase tracking-wide text-brand-700">{p.section}</span><span className="mt-0.5 block text-[14px]">{p.text}</span></span>
                    <span className="shrink-0 text-[12.5px] font-semibold text-brand-700">{p.taskIds.length ? `${p.taskIds.length} tasks ${openPoint === i ? "▲" : "▼"}` : ""}</span>
                  </button>
                  {openPoint === i && (
                    <div className="border-t border-line px-3 py-2">
                      {p.taskIds.length === 0 ? <p className="text-[13px] text-ink-3">No single task behind this point — it comes from the totals.</p>
                        : !pointTasks[i] ? <p className="text-[13px] text-ink-3">Loading tasks…</p>
                        : pointTasks[i].length === 0 ? <p className="text-[13px] text-ink-3">Those tasks are no longer on the board.</p>
                        : pointTasks[i].map((t) => <p key={t.id} className="py-1 text-[13.5px]">Room {t.room} · {t.title} <span className="text-ink-3">({t.status.replace("_", " ")})</span>{t.sample ? <Badge tone="brass" className="ml-2">Sample</Badge> : null}</p>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void downloadPdf()} className="min-h-11">Download PDF</Button>
              <Button variant="secondary" onClick={() => void copyText()} className="min-h-11">Copy text</Button>
              <Button variant="ghost" onClick={downloadMd} className="min-h-11">Download .md</Button>
            </div>
          </Card>
        )}

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Old reports</h2>
        {old.length === 0 ? <p className="mt-1.5 text-[13.5px] text-ink-3">No {kind} reports yet. Your first one will appear here and stay here.</p>
          : <ul className="mt-2 divide-y divide-line">{old.map((r) => (
            <li key={r.id}><button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left" onClick={() => { setSelectedId(r.id); setOpenPoint(null); }}>
              <span className="text-[14px] font-medium">{fmtWhen(r.createdAt)} · {r.kind === "daily" ? "Daily" : "Weekly"}{r.includesSample ? " · Includes sample data" : ""}</span>
              <span className="text-[12.5px] text-ink-3">{fmtWhen(r.createdAt)}{selected?.id === r.id ? " · showing" : ""}</span></button></li>))}
          </ul>}
      </Card>

      {isOwner && (
        <Card className="mt-4 p-5">
          <h2 className="text-[15px] font-semibold">Sample week (demo)</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-3">A weekly report needs a week of work. This creates clearly labelled sample tasks and history for the past 7 days (including a repeat problem to spot). Removing it deletes only the sample data.</p>
          <p className="mt-1.5 text-[13.5px] text-ink-3">{sampleCount ? `${sampleCount} sample tasks are loaded now.` : "No sample data is loaded now."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" loading={busy} disabled={sampleCount > 0} onClick={() => void sample("load")} className="min-h-11">Load sample week (demo)</Button>
            <Button variant="danger" loading={busy} disabled={sampleCount === 0} onClick={() => void sample("remove")} className="min-h-11">Remove sample data</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
