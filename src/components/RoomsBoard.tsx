"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button, Card, Empty, Input, Badge } from "@/components/ui";
import type { HotelSettings, Room } from "@/lib/hotel-data";

function linkFor(room: Room, appUrl?: string | null) {
  // APP_URL (public online address) wins so printed QR codes never point at
  // localhost or a preview URL; without it, the current origin (local dev).
  const base = appUrl || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/r/${encodeURIComponent(room.number)}?t=${encodeURIComponent(room.token)}`;
}

type RefRoom = Room & { reference?: unknown; pendingReference?: unknown; referenceHistory?: unknown[] };
// Keep in sync with REFERENCE_LABELS in src/lib/hotel-data.ts (client-safe copy).
const REF_LABELS = ["Bed area", "Bathroom", "Desk", "Entrance", "Balcony", "Other"];
const MAX_REF_PHOTOS = 6;

export function ReferenceSection({ room, onChanged, allRooms = [] }: { room: Room; onChanged: () => Promise<void>; allRooms?: Room[] }) {
  const r = room as RefRoom;
  const active = r.reference as { photos: { name: string; url: string; label: string }[]; uploadedBy: string; uploadedAt: string; reason: string | null; copiedFromRoom?: string | null } | null;
  const pending = r.pendingReference as { photos: { name: string; url: string; label: string }[]; checked?: boolean; itemSource?: string; checkFailed?: boolean } | null;
  const pendingMock = Boolean(pending && pending.checked && (pending.itemSource === "mock" || pending.checkFailed));
  const history = (r.referenceHistory ?? []) as { id: string; photos: { name: string; url: string; label: string }[]; uploadedBy: string; uploadedAt: string; reason: string | null }[];
  const [label, setLabel] = useState("Bed area");
  const [reason, setReason] = useState("");
  const [busyRef, setBusyRef] = useState(false);
  const [refMsg, setRefMsg] = useState<string | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [copyPick, setCopyPick] = useState<Set<string>>(new Set());
  const sameTypeRooms = allRooms.filter((x) => x.id !== room.id && x.roomType === room.roomType);

  async function upload(file: File, replaceName?: string, replaceLabel?: string) {
    setBusyRef(true); setRefError(null); setRefMsg(null);
    try {
      const form = new FormData(); form.append("photo", file); form.append("label", replaceLabel ?? label);
      if (replaceName) form.append("replaceName", replaceName);
      const res = await fetch(`/api/rooms/${room.id}/reference/photos`, { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not save the photo.");
      setRefMsg(replaceName ? "Photo replaced. Check the AI result below before setting the reference." : "Photo added. Check the AI result below — if it shows the room perfectly cleaned, set it as the perfect reference.");
      await onChanged();
    } catch (e) { setRefError(e instanceof Error ? e.message : "Could not save the photo."); }
    finally { setBusyRef(false); }
  }

  async function startEdit() {
    setBusyRef(true); setRefError(null); setRefMsg(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}/reference/edit`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not start editing.");
      setRefMsg("Editing a copy of the current perfect photos. Change any single photo, then set as perfect reference.");
      await onChanged();
    } catch (e) { setRefError(e instanceof Error ? e.message : "Could not start editing."); }
    finally { setBusyRef(false); }
  }

  async function copyToPicked() {
    const picked = sameTypeRooms.filter((x) => copyPick.has(x.id));
    if (!picked.length) { setRefError("Pick at least one room to copy to."); return; }
    if (!window.confirm(`Copy the perfect photos from room ${room.number} to: ${picked.map((x) => x.number).join(", ")}? Their current perfect photos (if any) will be saved in their history.`)) return;
    setBusyRef(true); setRefError(null); setRefMsg(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}/reference/copy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetIds: picked.map((x) => x.id) }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; copied?: string[] };
      if (!res.ok) throw new Error(d.error || "Could not copy.");
      setCopyPick(new Set());
      setRefMsg(`Copied to room${(d.copied ?? []).length === 1 ? "" : "s"} ${(d.copied ?? []).join(", ")}. Each of those rooms can still get its own photos later.`);
      await onChanged();
    } catch (e) { setRefError(e instanceof Error ? e.message : "Could not copy."); }
    finally { setBusyRef(false); }
  }

  async function approve() {
    setBusyRef(true); setRefError(null); setRefMsg(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}/reference`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() || undefined }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; replaced?: boolean };
      if (!res.ok) throw new Error(d.error || "Could not set the reference.");
      setReason("");
      setRefMsg(d.replaced ? "New perfect reference set. The old one is saved in the history below." : "Perfect reference set. The AI will compare cleaners' photos with it.");
      await onChanged();
    } catch (e) { setRefError(e instanceof Error ? e.message : "Could not set the reference."); }
    finally { setBusyRef(false); }
  }

  async function removePending(name: string) {
    setBusyRef(true); setRefError(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}/reference/photos?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove the photo.");
      await onChanged();
    } catch (e) { setRefError(e instanceof Error ? e.message : "Could not remove the photo."); }
    finally { setBusyRef(false); }
  }

  const thumbs = (photos: { name: string; url: string; label: string }[]) => (
    <ul className="mt-2 grid grid-cols-3 gap-2">
      {photos.map((ph) => (
        <li key={ph.name} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ph.url} alt={`Perfect room photo (${ph.label})`} className="aspect-square w-full rounded-xl border border-line object-cover" />
          <span className="absolute bottom-1 left-1 rounded bg-brand-950/80 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">{ph.label}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-[13px] font-semibold text-ink-2">Perfect room photos</p>
      {refMsg && <p className="mt-2 rounded-xl bg-ready-soft px-3 py-2 text-[12.5px] text-ready-deep" role="status">{refMsg}</p>}
      {refError && <p className="mt-2 rounded-xl bg-dirty-soft px-3 py-2 text-[12.5px] text-dirty-deep" role="alert">{refError}</p>}
      {active ? (
        <div>
          {thumbs(active.photos)}
          <p className="mt-2 text-[12.5px] text-ink-3">Perfect reference · {active.photos.length} photo{active.photos.length === 1 ? "" : "s"} · added by {active.uploadedBy} · {new Date(active.uploadedAt).toLocaleDateString()}{active.copiedFromRoom ? ` · Copied from room ${active.copiedFromRoom}` : ""}{active.reason ? ` · ${active.reason}` : ""}</p>
          {!pending && <Button size="sm" variant="secondary" className="mt-2" disabled={busyRef} onClick={() => void startEdit()}>Edit photos</Button>}
        </div>
      ) : !pending ? (
        <p className="mt-1.5 text-[12.5px] text-ink-3">No perfect photo yet. Add up to {MAX_REF_PHOTOS} photos of this room cleaned perfectly — the AI compares cleaners&apos; photos with them.</p>
      ) : null}
      {pending && (
        <div className="mt-2 rounded-xl bg-brand-50 p-3">
          <p className="text-[12.5px] font-semibold text-brand-800">{active ? "New photos — check them, then replace the reference:" : "New photos:"} ({pending.photos.length}/{MAX_REF_PHOTOS})</p>
          <ul className="mt-2 grid grid-cols-2 min-[420px]:grid-cols-3 gap-2">
            {pending.photos.map((ph) => (
              <li key={ph.name} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={`New perfect room photo (${ph.label})`} className="aspect-square w-full rounded-xl border border-line object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-brand-950/80 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">{ph.label}</span>
                <button type="button" disabled={busyRef} onClick={() => void removePending(ph.name)} aria-label={`Remove ${ph.label} photo`} className="absolute -top-2 -right-2 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-lg font-bold text-white disabled:opacity-50 sm:h-8 sm:w-8">×</button>
                <label className={`mt-1 flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-white px-2 text-[12px] font-semibold sm:min-h-9 ${busyRef ? "pointer-events-none opacity-50" : ""}`}>
                  Replace
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f, ph.name, ph.label); }} />
                </label>
              </li>
            ))}
          </ul>
          {pendingMock ? (
            <p className="mt-2 rounded-xl bg-occ-soft px-3 py-2 text-[12.5px] font-semibold text-occ-deep">The AI couldn&apos;t check this photo right now. Try again.</p>
          ) : (
            <p className="mt-2 text-[12.5px] text-ink-3">{pending.checked ? "AI check done. If the room looks perfect, set this as the reference." : "Checking the photos with the AI…"}</p>
          )}
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why replace? (optional, e.g. new furniture)" aria-label="Reason for replacing the reference" className="mt-2" />
          <Button size="sm" className="mt-2 w-full" disabled={busyRef || !pending.checked || pendingMock} loading={busyRef} onClick={() => void approve()}>Set as perfect reference</Button>
          {pendingMock && <p className="mt-1.5 text-[12.5px] text-ink-3">Add or replace a photo to run the check again — a photo the AI could not check cannot become the perfect reference.</p>}
        </div>
      )}
      {(!pending || pending.photos.length < MAX_REF_PHOTOS) && !(active && !pending) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <select className="h-11 px-2 rounded-lg border border-line bg-white text-sm sm:h-10" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Photo area label">
            {REF_LABELS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <label className={`flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-semibold sm:h-10 ${busyRef ? "pointer-events-none opacity-50" : ""}`}>
            {busyRef ? "Saving…" : pending ? "Add another photo" : "Add perfect photo"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
          </label>
        </div>
      )}
      {active && sameTypeRooms.length > 0 && (
        <div className="mt-3 rounded-xl border border-line p-3">
          <p className="text-[12.5px] font-semibold text-ink-2">Use for other rooms of the same type ({room.roomType})</p>
          <p className="mt-1 text-[12.5px] text-ink-3">Copy this room&apos;s approved photos and AI result. Those rooms can still get their own photos later.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sameTypeRooms.map((x) => (
              <li key={x.id}><label className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[13px] font-semibold"><input type="checkbox" className="size-4" checked={copyPick.has(x.id)} onChange={(e) => setCopyPick((prev) => { const n = new Set(prev); if (e.target.checked) n.add(x.id); else n.delete(x.id); return n; })} />Room {x.number}</label></li>
            ))}
          </ul>
          {copyPick.size > 0 && <p className="mt-2 text-[12.5px] text-ink-3">Preview: copy to room{copyPick.size === 1 ? "" : "s"} {sameTypeRooms.filter((x) => copyPick.has(x.id)).map((x) => x.number).join(", ")}.</p>}
          <Button size="sm" className="mt-2" disabled={busyRef || copyPick.size === 0} loading={busyRef} onClick={() => void copyToPicked()}>Copy to picked rooms</Button>
        </div>
      )}
      {history.length > 0 && (
        <div className="mt-2">
          <button type="button" className="inline-flex min-h-11 items-center text-[12.5px] font-semibold text-brand-700 hover:underline sm:min-h-0" onClick={() => setShowHistory((v) => !v)}>{showHistory ? "Hide" : "Show"} reference history ({history.length})</button>
          {showHistory && (
            <ul className="mt-2 space-y-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-xl bg-canvas p-2.5 text-[12.5px] text-ink-3">
                  {thumbs(h.photos)}
                  <p className="mt-1.5">Replaced · by {h.uploadedBy} · {new Date(h.uploadedAt).toLocaleString()}{h.reason ? ` · Reason: ${h.reason}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoomsBoard({ initialRooms, initialSettings, hotelName, canEdit, appUrl = null }: { initialRooms: Room[]; initialSettings: HotelSettings; hotelName: string; canEdit: boolean; appUrl?: string | null }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [settings, setSettings] = useState(initialSettings);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [floorFilter, setFloorFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullRoom, setFullRoom] = useState<Room | null>(null);
  const [menuRoomId, setMenuRoomId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [dlFormat, setDlFormat] = useState<"pdf" | "zip">("pdf");
  const [dlScope, setDlScope] = useState("all");
  const [downloading, setDownloading] = useState(false);

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b), [rooms]);
  const visible = rooms.filter((r) => (floorFilter === "all" || r.floor === Number(floorFilter)) && r.number.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const room of rooms) out[room.id] = await QRCode.toDataURL(linkFor(room, appUrl), { width: 320, margin: 1 });
      if (alive) setQr(out);
    })();
    return () => { alive = false; };
  }, [rooms, appUrl]);

  async function act(fn: () => Promise<Response>, okMsg: string) {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fn(); const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong.");
      setMsg(okMsg); return data;
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); return null; }
    finally { setBusy(false); }
  }

  async function brandedQrImage(room: Room): Promise<string> {
    const qrUrl = await QRCode.toDataURL(linkFor(room, appUrl), { width: 640, margin: 1 });
    try {
      const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
      const [qrImg, logoImg] = await Promise.all([load(qrUrl), load("/brand/readybell-logo.png")]);
      const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 980;
      const ctx = canvas.getContext("2d"); if (!ctx) return qrUrl;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 800, 980);
      ctx.drawImage(logoImg, 240, 28, 320, 64);
      ctx.fillStyle = "#5b6676"; ctx.font = "600 30px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(hotelName, 400, 140);
      ctx.fillStyle = "#0f1b2a"; ctx.font = "700 52px sans-serif";
      ctx.fillText(`Room ${room.number}`, 400, 205);
      ctx.drawImage(qrImg, 110, 230, 580, 580);
      ctx.fillStyle = "#334155"; ctx.font = "600 32px sans-serif";
      ctx.fillText("Scan to message the hotel", 400, 865);
      ctx.fillStyle = "#8d97a5"; ctx.font = "24px sans-serif";
      ctx.fillText("Powered by Readybell", 400, 915);
      return canvas.toDataURL("image/png");
    } catch { return qrUrl; }
  }

  async function downloadAll() {
    const chosen = dlScope === "all" ? rooms : rooms.filter((r) => r.floor === Number(dlScope));
    if (chosen.length === 0) { setError("No rooms to download. Pick another floor."); return; }
    setDownloading(true); setError(null); setMsg(null);
    try {
      // Make sure every chosen room has a QR image first.
      const images: Record<string, string> = {};
      for (const room of chosen) images[room.id] = await brandedQrImage(room);
      if (dlFormat === "zip") {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const room of chosen) zip.file(`${room.number}.png`, images[room.id].split(",")[1], { base64: true });
        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "room-qr-codes.zip"; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setMsg(`Downloaded ${chosen.length} QR image${chosen.length === 1 ? "" : "s"} in one ZIP file.`);
      } else {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const cols = 2, rows = 3, cardW = 88, cardH = 84, gapX = 10, gapY = 8, startX = 12, startY = 12;
        chosen.forEach((room, i) => {
          const slot = i % (cols * rows);
          if (i > 0 && slot === 0) doc.addPage();
          const x = startX + (slot % cols) * (cardW + gapX);
          const y = startY + Math.floor(slot / cols) * (cardH + gapY);
          doc.setDrawColor(210); doc.roundedRect(x, y, cardW, cardH, 3, 3, "S");
          doc.setFontSize(7); doc.setTextColor(140); doc.text("Readybell", x + cardW / 2, y + 5, { align: "center" });
          doc.setFontSize(9); doc.setTextColor(110); doc.text(hotelName, x + cardW / 2, y + 10, { align: "center" });
          doc.setFontSize(16); doc.setTextColor(20); doc.text(`Room ${room.number}`, x + cardW / 2, y + 15, { align: "center" });
          doc.addImage(images[room.id], "PNG", x + cardW / 2 - 24, y + 19, 48, 48);
          doc.setFontSize(10); doc.text("Scan to message the hotel", x + cardW / 2, y + 74, { align: "center" });
        });
        doc.save("room-qr-codes.pdf");
        setMsg(`Downloaded a PDF with ${chosen.length} QR card${chosen.length === 1 ? "" : "s"} — ready to print on A4.`);
      }
      setPrintOpen(false);
    } catch { setError("The download did not work. Please try again."); }
    finally { setDownloading(false); }
  }

  async function refresh() {
    const res = await fetch("/api/rooms", { cache: "no-store" });
    if (res.ok) { const d = await res.json() as { rooms: Room[]; settings: HotelSettings }; setRooms(d.rooms); setSettings(d.settings); }
  }

  return (
    <div>
      {msg && <div className="mb-3 rounded-xl bg-ready-soft px-3.5 py-3 text-[13.5px] text-ready-deep" role="status">{msg}</div>}
      {error && <div className="mb-3 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep" role="alert">{error}</div>}
      {!canEdit && <p className="mb-3 rounded-xl bg-brand-50 px-3.5 py-3 text-[13.5px] text-brand-800">You can view and print QR codes. Only the Owner can change them.</p>}

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <Input className="max-w-[220px]" placeholder="Search room number…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search by room number" />
        <select className="h-10 px-3 rounded-lg border border-line bg-white text-sm" value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} aria-label="Filter by floor">
          <option value="all">All floors</option>{floors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
        </select>
        <Button variant="secondary" onClick={() => { setDlScope(floorFilter); setPrintOpen(true); }}>Print all</Button>
        <Badge tone="brand">{visible.length} room{visible.length === 1 ? "" : "s"}</Badge>
      </div>

      {rooms.length === 0 ? (
        <Card><Empty title="No rooms yet" text="Add rooms in Rooms & prices first, then their QR codes will appear here." /></Card>
      ) : visible.length === 0 ? (
        <Card><Empty title="No rooms match" text="Try a different search or floor." /></Card>
      ) : (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visible.map((room) => (
            <Card key={room.id} className="p-4">
              <div className="flex justify-between items-start"><div><p className="font-display text-[20px] font-semibold">Room {room.number}</p><p className="text-[12.5px] text-ink-3">Floor {room.floor} · {hotelName}</p></div><Badge tone="neutral">QR</Badge></div>
              {qr[room.id] ? <img src={qr[room.id]} alt={`QR code for room ${room.number}`} className="mt-3 w-full max-w-[220px] mx-auto aspect-square" /> : <p className="mt-3 text-center text-[13px] text-ink-3 py-10">Making QR…</p>}
              <p className="text-center text-[12.5px] text-ink-3">Scan to message the hotel</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => void (async () => { const img = await brandedQrImage(room); const a = document.createElement("a"); a.href = img; a.download = `room-${room.number}-qr.png`; a.click(); setMsg(`QR image for room ${room.number} downloaded.`); })()}>Download PNG</Button>
                <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(linkFor(room, appUrl)).then(() => setMsg(`Link for room ${room.number} copied.`))}>Copy link</Button>
                <div className="relative">
                  <Button size="sm" variant="secondary" aria-label={`More actions for room ${room.number}`} aria-expanded={menuRoomId === room.id} onClick={() => setMenuRoomId(menuRoomId === room.id ? null : room.id)}>⋯</Button>
                  {menuRoomId === room.id && (
                    <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-white p-1.5 shadow-pop">
                      <button type="button" className="block min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold hover:bg-brand-50" onClick={() => { setMenuRoomId(null); setFullRoom(room); }}>Full screen</button>
                      {canEdit && <button type="button" className="block min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-dirty-deep hover:bg-dirty-soft" onClick={() => { setMenuRoomId(null); if (window.confirm(`Regenerate the QR code for room ${room.number}? The old QR code will stop working.`)) void (async () => { const d = await act(() => fetch(`/api/rooms/${room.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "regenerate" }) }), `New QR code for room ${room.number}. The old one no longer works.`); if (d) await refresh(); })(); }}>Regenerate</button>}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {printOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-brand-950/60 p-3" role="dialog" aria-modal="true" aria-label="How do you want to download?">
          <Card className="w-full max-w-md p-5">
            <h2 className="font-display text-[19px] font-semibold">How do you want to download?</h2>
            <p className="mt-1 text-[13px] text-ink-3">The file downloads straight to this device — no new page opens.</p>
            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Download format">
              <label className="flex gap-2.5 rounded-xl border border-line p-3 cursor-pointer has-checked:border-brand-600 has-checked:bg-brand-50">
                <input type="radio" name="dl-format" checked={dlFormat === "pdf"} onChange={() => setDlFormat("pdf")} className="mt-1" />
                <span><strong className="text-[14px]">PDF for printing</strong><br /><span className="text-[12.5px] text-ink-3">A4 sheets, several QR cards per page — hotel name, room number and &ldquo;Scan to message the hotel&rdquo; on every card.</span></span>
              </label>
              <label className="flex gap-2.5 rounded-xl border border-line p-3 cursor-pointer has-checked:border-brand-600 has-checked:bg-brand-50">
                <input type="radio" name="dl-format" checked={dlFormat === "zip"} onChange={() => setDlFormat("zip")} className="mt-1" />
                <span><strong className="text-[14px]">All as PNG (one ZIP file)</strong><br /><span className="text-[12.5px] text-ink-3">One image per room, each file named by its room number.</span></span>
              </label>
            </div>
            <label className="mt-4 block"><span className="block text-[12.5px] font-semibold mb-1">Which rooms?</span>
              <select className="h-10 w-full px-3 rounded-lg border border-line bg-white text-sm" value={dlScope} onChange={(e) => setDlScope(e.target.value)} aria-label="Rooms to download">
                <option value="all">All rooms ({rooms.length})</option>
                {floors.map((f) => <option key={f} value={f}>Floor {f} only ({rooms.filter((r) => r.floor === f).length})</option>)}
              </select>
            </label>
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" loading={downloading} onClick={() => void downloadAll()}>{downloading ? "Preparing…" : "Download"}</Button>
              <Button variant="secondary" disabled={downloading} onClick={() => setPrintOpen(false)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {fullRoom && (
        <div className="fixed inset-0 z-50 bg-brand-950 text-white flex flex-col items-center justify-center p-6" role="dialog" aria-modal="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/readybell-logo-on-dark.png" alt="Readybell" className="mb-3 h-8 w-auto" />
          <p className="text-[14px] text-brand-100/80">{hotelName}</p>
          <h2 className="font-display text-[36px] font-semibold mt-1">Room {fullRoom.number}</h2>
          {qr[fullRoom.id] && <img src={qr[fullRoom.id]} alt={`QR code for room ${fullRoom.number}`} className="mt-5 w-[min(70vw,420px)] aspect-square bg-white p-3 rounded-2xl" />}
          <p className="mt-4 text-[16px]">Scan to message the hotel</p>
          <Button className="mt-6" variant="secondary" onClick={() => setFullRoom(null)}>Close</Button>
        </div>
      )}
    </div>
  );
}
