"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button, Card, Empty, Input, Badge } from "@/components/ui";
import type { HotelSettings, Room } from "@/lib/hotel-data";

function linkFor(room: Room) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/r/${encodeURIComponent(room.number)}?t=${encodeURIComponent(room.token)}`;
}

export default function RoomsBoard({ initialRooms, initialSettings, hotelName, canEdit }: { initialRooms: Room[]; initialSettings: HotelSettings; hotelName: string; canEdit: boolean }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [settings, setSettings] = useState(initialSettings);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [floorFilter, setFloorFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [floor, setFloor] = useState("1"); const [from, setFrom] = useState("101"); const [to, setTo] = useState("110");
  const [singleNumber, setSingleNumber] = useState(""); const [singleFloor, setSingleFloor] = useState("1");
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [fullRoom, setFullRoom] = useState<Room | null>(null);
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
      for (const room of rooms) out[room.id] = await QRCode.toDataURL(linkFor(room), { width: 320, margin: 1 });
      if (alive) setQr(out);
    })();
    return () => { alive = false; };
  }, [rooms]);

  async function act(fn: () => Promise<Response>, okMsg: string) {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fn(); const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong.");
      setMsg(okMsg); return data;
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); return null; }
    finally { setBusy(false); }
  }

  async function downloadAll() {
    const chosen = dlScope === "all" ? rooms : rooms.filter((r) => r.floor === Number(dlScope));
    if (chosen.length === 0) { setError("No rooms to download. Pick another floor."); return; }
    setDownloading(true); setError(null); setMsg(null);
    try {
      // Make sure every chosen room has a QR image first.
      const images: Record<string, string> = { ...qr };
      for (const room of chosen) {
        if (!images[room.id]) images[room.id] = await QRCode.toDataURL(linkFor(room), { width: 640, margin: 1 });
      }
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
          doc.setFontSize(9); doc.setTextColor(110); doc.text(hotelName, x + cardW / 2, y + 8, { align: "center" });
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

      {canEdit && (
        <Card className="p-5 mb-4">
          <h2 className="text-[15px] font-semibold">{rooms.length === 0 ? "Add your rooms" : "Add rooms"}</h2>
          {rooms.length === 0 && <p className="mt-1 text-[13.5px] text-ink-3">Tell us your floors and room numbers. We make one QR code per room — print them and put one in each room.</p>}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <label className="block"><span className="block text-[12.5px] font-semibold mb-1">Floor</span><Input value={floor} onChange={(e) => setFloor(e.target.value)} inputMode="numeric" /></label>
            <label className="block"><span className="block text-[12.5px] font-semibold mb-1">First room</span><Input value={from} onChange={(e) => setFrom(e.target.value)} inputMode="numeric" /></label>
            <label className="block"><span className="block text-[12.5px] font-semibold mb-1">Last room</span><Input value={to} onChange={(e) => setTo(e.target.value)} inputMode="numeric" /></label>
            <Button disabled={busy} onClick={() => void (async () => { const d = await act(() => fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ floor: Number(floor), from: Number(from), to: Number(to) }) }), `Added rooms ${from}–${to} on floor ${floor}.`); if (d) await refresh(); })()}>Add rooms</Button>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
            <label className="block"><span className="block text-[12.5px] font-semibold mb-1">One room number</span><Input value={singleNumber} onChange={(e) => setSingleNumber(e.target.value)} placeholder="204" /></label>
            <label className="block"><span className="block text-[12.5px] font-semibold mb-1">Its floor</span><Input value={singleFloor} onChange={(e) => setSingleFloor(e.target.value)} inputMode="numeric" /></label>
            <Button variant="secondary" disabled={busy || !singleNumber.trim()} onClick={() => void (async () => { const d = await act(() => fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number: singleNumber, floor: Number(singleFloor) }) }), `Room ${singleNumber} added.`); if (d) { setSingleNumber(""); await refresh(); } })()}>Add one room</Button>
          </div>
          <label className="mt-4 flex items-start gap-2 text-[13.5px]">
            <input type="checkbox" className="mt-1" checked={settings.allowLinksWithoutToken} disabled={busy} onChange={(e) => void (async () => { const d = await act(() => fetch("/api/rooms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allowLinksWithoutToken: e.target.checked }) }), "Saved."); if (d) await refresh(); })()} />
            <span><strong>Allow links without QR code (demo mode)</strong><br /><span className="text-ink-3">On: /r/204 works without the secret code. Off: guests must use the QR code.</span></span>
          </label>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <Input className="max-w-[220px]" placeholder="Search room number…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search by room number" />
        <select className="h-10 px-3 rounded-lg border border-line bg-white text-sm" value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} aria-label="Filter by floor">
          <option value="all">All floors</option>{floors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
        </select>
        <Button variant="secondary" onClick={() => { setDlScope(floorFilter); setPrintOpen(true); }}>Print all</Button>
        <Badge tone="brand">{visible.length} room{visible.length === 1 ? "" : "s"}</Badge>
      </div>

      {rooms.length === 0 ? (
        <Card><Empty title="No rooms yet" text={canEdit ? "Add your rooms above — for example floor 1: 101–110, floor 2: 201–215." : "The Owner has not added rooms yet."} /></Card>
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
                <Button size="sm" variant="secondary" onClick={() => { const a = document.createElement("a"); a.href = qr[room.id]; a.download = `room-${room.number}-qr.png`; a.click(); }}>Download PNG</Button>
                <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(linkFor(room)).then(() => setMsg(`Link for room ${room.number} copied.`))}>Copy link</Button>
                <Button size="sm" variant="secondary" onClick={() => setFullRoom(room)}>Show full screen</Button>
              </div>
              {canEdit && (
                <div className="mt-3 border-t border-line pt-3 space-y-2">
                  <div className="flex gap-1.5"><Input value={edit[room.id] ?? room.number} onChange={(e) => setEdit({ ...edit, [room.id]: e.target.value })} aria-label={`Fix room number for room ${room.number}`} /><Button size="sm" disabled={busy} onClick={() => void (async () => { const d = await act(() => fetch(`/api/rooms/${room.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number: edit[room.id] ?? room.number }) }), "Room number saved."); if (d) await refresh(); })()}>Save number</Button></div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => { if (window.confirm(`Regenerate the QR code for room ${room.number}? The old QR code for room ${room.number} will stop working.`)) void (async () => { const d = await act(() => fetch(`/api/rooms/${room.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "regenerate" }) }), `New QR code for room ${room.number}. The old one no longer works.`); if (d) await refresh(); })(); }}>Regenerate</Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => { if (window.confirm(`Remove room ${room.number}? Its QR code will stop working.`)) void (async () => { const d = await act(() => fetch(`/api/rooms/${room.id}`, { method: "DELETE" }), `Room ${room.number} removed.`); if (d) await refresh(); })(); }}>Remove</Button>
                  </div>
                </div>
              )}
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
