"use client";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Empty } from "@/components/ui";
import { ReferenceSection } from "@/components/RoomsBoard";
import type { HotelSettings, Room } from "@/lib/hotel-data";

type RefShape = { photos: unknown[]; uploadedBy: string; uploadedAt: string } | null;

function statusOf(room: Room): { label: "Set" | "Waiting for approval" | "Not set"; tone: string; count: number; rec: RefShape } {
  const r = room as Room & { reference?: RefShape; pendingReference?: RefShape };
  if (r.pendingReference) return { label: "Waiting for approval", tone: "occ", count: r.pendingReference.photos.length, rec: r.pendingReference };
  if (r.reference) return { label: "Set", tone: "ready", count: r.reference.photos.length, rec: r.reference };
  return { label: "Not set", tone: "dirty", count: 0, rec: null };
}

export default function PerfectPhotosBoard({ initialRooms, initialSettings, canEditSettings, initialRoomId = null }: { initialRooms: Room[]; initialSettings: HotelSettings; canEditSettings: boolean; initialRoomId?: string | null }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [settings, setSettings] = useState(initialSettings);
  const [statusFilter, setStatusFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(initialRoomId);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b), [rooms]);
  const types = useMemo(() => [...new Set(rooms.map((r) => r.roomType))].sort(), [rooms]);
  const detail = rooms.find((r) => r.id === detailId) ?? null;
  const aiOn = settings.aiPhotoCheckEnabled;

  const visible = rooms.filter((r) => {
    const s = statusOf(r).label;
    if (statusFilter === "missing" && s !== "Not set") return false;
    if (floorFilter !== "all" && r.floor !== Number(floorFilter)) return false;
    if (typeFilter !== "all" && r.roomType !== typeFilter) return false;
    return true;
  });

  async function refresh() {
    const res = await fetch("/api/rooms", { cache: "no-store" });
    if (res.ok) { const d = (await res.json()) as { rooms: Room[]; settings: HotelSettings }; setRooms(d.rooms); setSettings(d.settings); }
  }

  async function saveSettings(patch: Partial<HotelSettings>, okMsg: string) {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/rooms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; settings?: HotelSettings };
      if (!res.ok || !d.settings) throw new Error(d.error || "Could not save the setting.");
      setSettings(d.settings);
      setMsg(okMsg);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the setting."); await refresh(); }
    finally { setBusy(false); }
  }

  const switchRow = (label: string, hint: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3.5">
      <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={checked} disabled={!canEditSettings || busy} onChange={(e) => onChange(e.target.checked)} />
      <span><strong className="text-[14px]">{label}: {checked ? "On" : "Off"}</strong><br /><span className="text-[12.5px] text-ink-3">{hint}</span>{!canEditSettings && <span className="block text-[12.5px] text-ink-3">Only the Owner can change this.</span>}</span>
    </label>
  );

  return (
    <div>
      {msg && <p className="mb-3 rounded-xl bg-ready-soft px-3.5 py-3 text-[13.5px] text-ready-deep" role="status">{msg}</p>}
      {error && <p className="mb-3 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep" role="alert">{error}</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {switchRow("AI photo check for cleaning", "When on, cleaners' photos are compared with each room's perfect photos.", settings.aiPhotoCheckEnabled, (v) => void saveSettings({ aiPhotoCheckEnabled: v }, v ? "AI photo check is on. Perfect photos are used again — nothing was deleted." : "AI photo check is off. Saved perfect photos are kept and will come back when you turn it on."))}
        {switchRow("Cleaners must add a photo", "When on, a cleaning task needs at least 1 photo before it can be sent to review.", settings.cleanerPhotoRequired, (v) => void saveSettings({ cleanerPhotoRequired: v }, v ? "Cleaners must add a photo again." : "Cleaners can now send cleaning to review with no photo."))}
      </div>

      {!aiOn ? (
        <Card className="mt-4 p-5">
          <h2 className="text-[15px] font-semibold">AI photo check is off</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-3">No AI check runs and perfect photos are not used right now. Cleaning works like this: Accept → Start → photo (if required above) → Send to review → a supervisor approves. Your saved perfect photos are kept — turn the AI check back on and everything comes back.</p>
        </Card>
      ) : (
        <>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-white p-3.5">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={settings.autoApproveCleaning} disabled={!canEditSettings || busy} onChange={(e) => void saveSettings({ autoApproveCleaning: e.target.checked }, e.target.checked ? "Auto-approve is on. Sure AI passes now finish cleaning tasks automatically." : "Auto-approve is off.")} />
            <span><strong className="text-[14px]">Auto-approve cleaning when the AI is sure</strong><br /><span className="text-[12.5px] text-ink-3">Off by default. When on, a cleaning photo that clearly matches the perfect room photo finishes the task without waiting for a supervisor. A supervisor can still reopen it.</span></span>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <select className="h-11 rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by perfect photo status"><option value="all">All rooms</option><option value="missing">Missing only</option></select>
            <select className="h-11 rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} aria-label="Filter by floor"><option value="all">All floors</option>{floors.map((f) => <option key={f} value={f}>Floor {f}</option>)}</select>
            <select className="h-11 rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by room type"><option value="all">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
            <Badge tone="brand">{visible.length} room{visible.length === 1 ? "" : "s"}</Badge>
          </div>

          {rooms.length === 0 ? (
            <Card className="mt-3"><Empty title="No rooms yet" text="Add rooms first on the QR codes tab — then set their perfect photos here." /></Card>
          ) : visible.length === 0 ? (
            <Card className="mt-3"><Empty title="No rooms match" text="Try different filters." /></Card>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((room) => {
                const s = statusOf(room);
                return (
                  <button key={room.id} type="button" onClick={() => setDetailId(room.id)} className={`min-h-11 rounded-xl2 border bg-white p-4 text-left shadow-card transition hover:border-brand-500 ${detailId === room.id ? "ring-2 ring-brand-500" : "border-line"}`} aria-label={`Open perfect photos for room ${room.number}`}>
                    <span className="block font-display text-[20px] font-semibold leading-tight">Room {room.number}</span>
                    <span className="block text-[12.5px] text-ink-3">Floor {room.floor} · {room.roomType}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5"><Badge tone={s.tone}>{s.label}</Badge><Badge tone="neutral">{s.count} photo{s.count === 1 ? "" : "s"}</Badge></span>
                    <span className="mt-2 block text-[12.5px] text-ink-3">{s.rec ? `Last updated ${new Date(s.rec.uploadedAt).toLocaleDateString()} by ${s.rec.uploadedBy}` : "No perfect photos yet"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {detail && (
            <Card className="mt-4 border-brand-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h2 className="font-display text-[20px] font-semibold">Room {detail.number} — perfect photos</h2><p className="text-[12.5px] text-ink-3">Floor {detail.floor} · {detail.roomType} · status: {statusOf(detail).label}</p></div>
                <Button variant="secondary" size="sm" onClick={() => setDetailId(null)}>Close</Button>
              </div>
              <ReferenceSection room={detail} onChanged={refresh} allRooms={rooms} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
