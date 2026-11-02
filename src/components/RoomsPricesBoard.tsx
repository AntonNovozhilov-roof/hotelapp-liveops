"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Empty, Field, Input, Textarea } from "@/components/ui";
import type { Room } from "@/lib/hotel-data";
import type { Booking } from "@/lib/booking-types";
import { roomStatusToday } from "@/lib/booking-types";
import { formatMoney } from "@/lib/money";

const TYPE_OPTIONS = ["Standard", "Double", "Suite"];
const STATUS_TONE: Record<string, string> = { Free: "ready", Occupied: "occ", "Arriving today": "brand", "Leaving today": "dirty" };

export default function RoomsPricesBoard({ initialRooms, bookings, currency, canEdit, aiPhotoCheckEnabled = true }: { initialRooms: Room[]; bookings: Booking[]; currency: string; canEdit: boolean; aiPhotoCheckEnabled?: boolean }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState("");
  const [bulkCustom, setBulkCustom] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // detail form
  const detail = rooms.find((r) => r.id === detailId) ?? null;
  const [dType, setDType] = useState("Standard");
  const [dCustom, setDCustom] = useState("");
  const [dPrice, setDPrice] = useState("");
  const [dNotes, setDNotes] = useState("");
  const [dNumber, setDNumber] = useState("");
  const [aFloor, setAFloor] = useState("1"); const [aFrom, setAFrom] = useState("101"); const [aTo, setATo] = useState("110");
  const [aSingle, setASingle] = useState(""); const [aSingleFloor, setASingleFloor] = useState("1");

  const floors = useMemo(() => [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b), [rooms]);

  async function refresh() {
    const res = await fetch("/api/rooms", { cache: "no-store" });
    if (res.ok) { const d = (await res.json()) as { rooms: Room[] }; setRooms(d.rooms); }
  }

  function openDetail(room: Room) {
    setDetailId(room.id);
    const isStandard = TYPE_OPTIONS.includes(room.roomType);
    setDType(isStandard ? room.roomType : "Custom");
    setDCustom(isStandard ? "" : room.roomType);
    setDPrice(String(room.pricePerNight || ""));
    setDNotes(room.notes || "");
    setDNumber(room.number);
  }

  async function applyBulk() {
    const type = bulkType === "Custom" ? bulkCustom.trim() : bulkType;
    if (!type && bulkPrice === "") { setError("Set a new type or a new price first."); return; }
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/rooms/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected], roomType: type || undefined, pricePerNight: bulkPrice === "" ? undefined : Number(bulkPrice) }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; changed?: number };
      if (!res.ok) throw new Error(d.error || "Could not save.");
      setMsg(`Saved for ${d.changed} room${d.changed === 1 ? "" : "s"}.`);
      setSelected(new Set());
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  async function addRooms() {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ floor: Number(aFloor), from: Number(aFrom), to: Number(aTo) }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not add rooms.");
      setMsg(`Added rooms ${aFrom}–${aTo} on floor ${aFloor}.`); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add rooms."); } finally { setBusy(false); }
  }
  async function addOneRoom() {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number: aSingle, floor: Number(aSingleFloor) }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not add the room.");
      setMsg(`Room ${aSingle} added.`); setASingle(""); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add the room."); } finally { setBusy(false); }
  }
  async function removeRoom() {
    if (!detail || !window.confirm(`Remove room ${detail.number}? Its QR code will stop working.`)) return;
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(`/api/rooms/${detail.id}`, { method: "DELETE" });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not remove the room.");
      setMsg(`Room ${detail.number} removed.`); setDetailId(null); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove the room."); } finally { setBusy(false); }
  }

  async function saveDetail() {
    if (!detail) return;
    const type = dType === "Custom" ? dCustom.trim() : dType;
    if (!type) { setError("Write the custom room type."); return; }
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(`/api/rooms/${detail.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomType: type, pricePerNight: Number(dPrice || 0), notes: dNotes, number: dNumber.trim() || undefined }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not save the room.");
      setMsg(`Room ${detail.number} saved.`);
      await refresh();
      const fresh = (await (await fetch("/api/rooms", { cache: "no-store" })).json() as { rooms: Room[] }).rooms.find((r) => r.id === detail.id);
      if (fresh) openDetail(fresh);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the room."); }
    finally { setBusy(false); }
  }


  return (
    <div>
      {msg && <p className="mb-3 rounded-xl bg-ready-soft px-3.5 py-3 text-[13.5px] text-ready-deep" role="status">{msg}</p>}
      {error && <p className="mb-3 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep" role="alert">{error}</p>}

      {canEdit && (
        <Card className="mb-4 p-5">
          <h2 className="text-[15px] font-semibold">Add rooms</h2>
          <div className="mt-3 grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
            <label className="block"><span className="mb-1 block text-[12.5px] font-semibold">Floor</span><Input value={aFloor} onChange={(e) => setAFloor(e.target.value)} inputMode="numeric" aria-label="Floor for new rooms" /></label>
            <label className="block"><span className="mb-1 block text-[12.5px] font-semibold">First room</span><Input value={aFrom} onChange={(e) => setAFrom(e.target.value)} inputMode="numeric" aria-label="First room number" /></label>
            <label className="block"><span className="mb-1 block text-[12.5px] font-semibold">Last room</span><Input value={aTo} onChange={(e) => setATo(e.target.value)} inputMode="numeric" aria-label="Last room number" /></label>
            <Button disabled={busy} onClick={() => void addRooms()}>Add rooms</Button>
          </div>
          <div className="mt-3 grid grid-cols-2 items-end gap-2 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-[12.5px] font-semibold">One room number</span><Input value={aSingle} onChange={(e) => setASingle(e.target.value)} placeholder="204" aria-label="One room number" /></label>
            <label className="block"><span className="mb-1 block text-[12.5px] font-semibold">Its floor</span><Input value={aSingleFloor} onChange={(e) => setASingleFloor(e.target.value)} inputMode="numeric" aria-label="Floor for one room" /></label>
            <Button variant="secondary" disabled={busy || !aSingle.trim()} onClick={() => void addOneRoom()}>Add one room</Button>
          </div>
        </Card>
      )}
      <p className="mb-3 text-[13px] text-ink-3">Tap a room to edit it.</p>
      {rooms.length === 0 && <Card className="mb-4"><Empty title="No rooms yet" text="Add your rooms above — for example floor 1: 101–110, floor 2: 201–210." /></Card>}

      {canEdit && selected.size > 0 && (
        <Card className="mb-4 border-brand-200 bg-brand-50 p-4">
          <p className="text-[14px] font-semibold">{selected.size} room{selected.size === 1 ? "" : "s"} picked — set type or price in one go</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <select className="h-11 rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={bulkType} onChange={(e) => setBulkType(e.target.value)} aria-label="New room type for picked rooms">
              <option value="">Keep type…</option>{TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}<option value="Custom">Custom name…</option>
            </select>
            {bulkType === "Custom" ? <Input value={bulkCustom} onChange={(e) => setBulkCustom(e.target.value)} placeholder="e.g. Family" aria-label="Custom room type" /> : <span className="hidden sm:block" />}
            <Input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} inputMode="decimal" placeholder={`Price / night (${currency})`} aria-label="New price per night for picked rooms" />
            <div className="flex gap-1.5"><Button loading={busy} onClick={() => void applyBulk()}>Apply to {selected.size}</Button><Button variant="secondary" disabled={busy} onClick={() => setSelected(new Set())}>Clear</Button></div>
          </div>
        </Card>
      )}

      {floors.map((floor) => (
        <div key={floor} className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[14px] font-semibold">Floor {floor}</h2>
            {canEdit && <button type="button" className="inline-flex min-h-11 items-center text-[12.5px] font-semibold text-brand-700 hover:underline sm:min-h-0" onClick={() => { const ids = rooms.filter((r) => r.floor === floor).map((r) => r.id); setSelected((prev) => { const next = new Set(prev); const allOn = ids.every((id) => next.has(id)); ids.forEach((id) => (allOn ? next.delete(id) : next.add(id))); return next; }); }}>Pick whole floor</button>}
          </div>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rooms.filter((r) => r.floor === floor).map((room) => {
              const status = roomStatusToday(room.number, bookings);
              const hasPerfect = Boolean((room as { reference?: unknown }).reference);
              return (
                <Card key={room.id} className={`p-4 ${detailId === room.id ? "ring-2 ring-brand-500" : ""}`}>
                  <div className="flex items-start gap-2">
                    {canEdit && <input type="checkbox" className="mt-1.5 size-5 shrink-0" checked={selected.has(room.id)} onChange={(e) => setSelected((prev) => { const next = new Set(prev); if (e.target.checked) next.add(room.id); else next.delete(room.id); return next; })} aria-label={`Pick room ${room.number} for bulk edit`} />}
                    <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => openDetail(room)} aria-label={`Open room ${room.number} details`}>
                      <span className="block font-display text-[20px] font-semibold leading-tight">Room {room.number}</span>
                      <span className="block text-[12.5px] text-ink-3">{room.roomType} · {room.pricePerNight ? formatMoney(room.pricePerNight, currency) : "no price set"} / night</span>
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                    {aiPhotoCheckEnabled && <Badge tone={hasPerfect ? "ready" : "neutral"}>{hasPerfect ? "Perfect photo ✓" : "No perfect photo"}</Badge>}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {detail && (
        <Card className="border-brand-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="font-display text-[20px] font-semibold">Room {detail.number} — details</h2><p className="text-[12.5px] text-ink-3">Floor {detail.floor} · today: {roomStatusToday(detail.number, bookings)}</p></div>
            <Button variant="secondary" size="sm" onClick={() => setDetailId(null)}>Close</Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Room number"><Input value={dNumber} onChange={(e) => setDNumber(e.target.value)} disabled={!canEdit} aria-label="Room number" /></Field>
            <Field label="Room type">
              <select className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={dType} onChange={(e) => setDType(e.target.value)} disabled={!canEdit} aria-label="Room type">
                {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}<option value="Custom">Custom name…</option>
              </select>
            </Field>
            {dType === "Custom" && <Field label="Custom type name"><Input value={dCustom} onChange={(e) => setDCustom(e.target.value)} placeholder="e.g. Family" disabled={!canEdit} /></Field>}
            <Field label={`Price per night (${currency})`}><Input value={dPrice} onChange={(e) => setDPrice(e.target.value)} inputMode="decimal" placeholder="80" disabled={!canEdit} /></Field>
          </div>
          <Field label="Notes" className="mt-3"><Textarea value={dNotes} onChange={(e) => setDNotes(e.target.value)} rows={2} placeholder="e.g. Sea view, quiet floor, renovated 2026" disabled={!canEdit} /></Field>
          {dNotes && <p className="mt-1 text-[12.5px] text-ink-3">Saved notes: {dNotes}</p>}
          {canEdit && <div className="mt-3 flex flex-wrap gap-2"><Button loading={busy} onClick={() => void saveDetail()}>Save room</Button><Button variant="danger" disabled={busy} onClick={() => void removeRoom()}>Remove room</Button></div>}
          {aiPhotoCheckEnabled && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-[13px] font-semibold text-ink-2">Perfect photos</p>
              <p className="mt-1 text-[12.5px] text-ink-3">{(() => { const d = detail as Room & { reference?: { photos: unknown[] } | null; pendingReference?: unknown }; return d.pendingReference ? "Waiting for approval — new perfect photos are waiting to be set." : d.reference ? `Set ✓ (${d.reference.photos.length} photo${d.reference.photos.length === 1 ? "" : "s"})` : "Not set yet."; })()}</p>
              <Link href={`/owner/rooms?tab=perfect&room=${encodeURIComponent(detail.id)}`}><Button variant="secondary" size="sm" className="mt-2">Open Perfect photos tab</Button></Link>
            </div>
          )}
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-[13px] font-semibold text-ink-2">QR code</p>
            <p className="mt-1 text-[12.5px] text-ink-3">Print or download this room&apos;s QR from the QR codes tab.</p>
            <Link href="/owner/rooms?tab=qr"><Button variant="secondary" size="sm" className="mt-2">Open QR codes tab</Button></Link>
          </div>
        </Card>
      )}
    </div>
  );
}
