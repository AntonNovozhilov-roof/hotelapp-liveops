"use client";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Empty, Field, Input } from "@/components/ui";
import { addDaysStr, dateStr, nightsBetween, todayStr, type Booking } from "@/lib/booking-types";
import { formatMoney } from "@/lib/money";

interface RoomLite { id: string; number: string; floor: number; roomType: string; pricePerNight: number }
const SOURCES = ["Direct", "Booking.com", "Airbnb", "Other"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDay(dstr: string): string { const d = new Date(`${dstr}T12:00:00`); return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; }

export default function BookingsBoard({ initialBookings, rooms, currency, canEdit }: { initialBookings: Booking[]; rooms: RoomLite[]; currency: string; canEdit: boolean }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [weekOffset, setWeekOffset] = useState(0);
  const [phoneDay, setPhoneDay] = useState(todayStr());
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<null | { id: string | null; roomId: string; checkIn: string; checkOut: string; guests: string; price: string; source: string; guestName: string; reference: string }>(null);

  const start = addDaysStr(todayStr(), weekOffset * 7);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDaysStr(start, i)), [start]);
  const active = bookings.filter((b) => b.status === "active");
  const byRoomDay = (roomNumber: string, day: string) => active.find((b) => b.roomNumber === roomNumber && b.checkIn <= day && day < b.checkOut);
  const arriving = (roomNumber: string, day: string) => active.find((b) => b.roomNumber === roomNumber && b.checkIn === day);

  async function refresh() {
    const res = await fetch("/api/bookings", { cache: "no-store" });
    if (res.ok) { const d = (await res.json()) as { bookings: Booking[] }; setBookings(d.bookings); }
  }

  function openNew(roomId?: string, day?: string) {
    const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
    if (!room) { setError("Add rooms first, then bookings."); return; }
    const checkIn = day ?? todayStr();
    setForm({ id: null, roomId: room.id, checkIn, checkOut: addDaysStr(checkIn, 1), guests: "2", price: String(room.pricePerNight || ""), source: "Direct", guestName: "", reference: "" });
    setError(null);
  }
  function openEdit(b: Booking) {
    setForm({ id: b.id, roomId: b.roomId, checkIn: b.checkIn, checkOut: b.checkOut, guests: String(b.guests), price: String(b.pricePerNight), source: b.source, guestName: b.guestName, reference: b.reference });
    setError(null);
  }

  const formRoom = rooms.find((r) => r.id === form?.roomId);
  const formNights = form ? Math.max(0, nightsBetween(form.checkIn, form.checkOut)) : 0;
  const formTotal = formNights * (Number(form?.price) || 0);

  async function save() {
    if (!form) return;
    setBusy(true); setError(null); setMsg(null);
    try {
      const payload = { roomId: form.roomId, checkIn: form.checkIn, checkOut: form.checkOut, guests: Number(form.guests) || 1, pricePerNight: Number(form.price) || 0, source: form.source, guestName: form.guestName, reference: form.reference };
      const res = form.id
        ? await fetch(`/api/bookings/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "Could not save the booking.");
      setMsg(form.id ? "Booking saved." : "Booking added.");
      setForm(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the booking."); }
    finally { setBusy(false); }
  }

  async function act(id: string, action: "cancel" | "checkout") {
    if (action === "cancel" && !window.confirm("Cancel this booking? The room becomes free for those dates.")) return;
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string; cleaningCreated?: boolean };
      if (!res.ok) throw new Error(d.error || "That did not work.");
      setMsg(action === "cancel" ? "Booking cancelled." : d.cleaningCreated ? "Checked out — a cleaning task was created for housekeeping." : "Already checked out — the cleaning task already exists, so no new one was made.");
      setForm(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "That did not work."); }
    finally { setBusy(false); }
  }

  const bookingLabel = (b: Booking) => `${b.roomNumber} · ${b.checkIn} → ${b.checkOut} · ${formatMoney(b.total, currency)}${b.guestName ? ` · ${b.guestName}` : ""}${b.checkoutTaskId ? " · cleaning ✓" : ""}`;
  const phoneBookings = active.filter((b) => b.checkIn <= phoneDay && phoneDay < b.checkOut || b.checkIn === phoneDay || b.checkOut === phoneDay);

  if (rooms.length === 0) return <Card><Empty title="No rooms yet" text="Add rooms first on the QR codes tab, then you can take bookings." /></Card>;

  return (
    <div>
      {msg && <p className="mb-3 rounded-xl bg-ready-soft px-3.5 py-3 text-[13.5px] text-ready-deep" role="status">{msg}</p>}
      {error && <p className="mb-3 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep" role="alert">{error}</p>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {canEdit && <Button onClick={() => openNew()}>New booking</Button>}
        <p className="text-[12.5px] text-ink-3">Manual bookings only — no booking-site sync. Guest names stay inside the hotel: never in reports or AI.</p>
      </div>

      {/* Desktop calendar grid: rooms x next 14 days */}
      <Card className="hidden overflow-x-auto p-3 md:block">
        <div className="mb-2 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setWeekOffset((v) => v - 1)}>← Prev week</Button>
          <p className="text-[13px] font-semibold">{fmtDay(days[0])} – {fmtDay(days[13])}</p>
          <Button variant="secondary" size="sm" onClick={() => setWeekOffset((v) => v + 1)}>Next week →</Button>
          {weekOffset !== 0 && <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>Back to today</Button>}
        </div>
        <table className="w-full border-collapse text-[12px]">
          <thead><tr><th className="sticky left-0 bg-white p-1.5 text-left">Room</th>{days.map((d) => <th key={d} className={`min-w-16 p-1.5 text-center font-semibold ${d === todayStr() ? "bg-brand-50 text-brand-800" : ""}`}>{new Date(`${d}T12:00:00`).getDate()}<span className="block text-[10px] font-normal text-ink-3">{DAY_NAMES[new Date(`${d}T12:00:00`).getDay()]}</span></th>)}</tr></thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-t border-line">
                <th className="sticky left-0 bg-white p-1.5 text-left whitespace-nowrap">{room.number}<span className="block text-[10px] font-normal text-ink-3">{room.roomType}</span></th>
                {days.map((day) => {
                  const b = byRoomDay(room.number, day);
                  const isArrival = b && b.checkIn === day;
                  return (
                    <td key={day} className="p-0.5">
                      {b ? (
                        <button type="button" disabled={!canEdit} onClick={() => openEdit(b)} className={`block min-h-11 w-full rounded-md px-1 py-1 text-left text-[11px] font-semibold ${isArrival ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-900"} disabled:opacity-70`} title={bookingLabel(b)}>
                          {isArrival ? `▶ ${b.guests}g · ${formatMoney(b.pricePerNight, currency)}` : "···"}
                        </button>
                      ) : (
                        <button type="button" disabled={!canEdit} onClick={() => openNew(room.id, day)} className="block min-h-11 w-full rounded-md px-1 py-1 text-center text-ink-4 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50" aria-label={`New booking, room ${room.number}, ${day}`}>+</button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[12px] text-ink-3">Tap a booked cell to edit, cancel or check out. Tap + for a new booking. A darker cell is arrival day.</p>
      </Card>

      {/* Phone: list per day */}
      <div className="md:hidden">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPhoneDay((d) => addDaysStr(d, -1))}>←</Button>
            <div className="flex-1 text-center"><p className="text-[14px] font-semibold">{fmtDay(phoneDay)}{phoneDay === todayStr() ? " (today)" : ""}</p></div>
            <Button variant="secondary" size="sm" onClick={() => setPhoneDay((d) => addDaysStr(d, 1))}>→</Button>
          </div>
          <input type="date" className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm" value={phoneDay} onChange={(e) => e.target.value && setPhoneDay(e.target.value)} aria-label="Pick a day" />
        </Card>
        {phoneBookings.length === 0 ? (
          <Card className="mt-3"><Empty title="No bookings this day" text="No arrivals, stays or departures on this day. Tap New booking to add one." /></Card>
        ) : (
          <ul className="mt-3 space-y-2">
            {phoneBookings.map((b) => (
              <li key={b.id}><Card className="p-4">
                <div className="flex flex-wrap items-center gap-2"><p className="font-display text-[17px] font-semibold">Room {b.roomNumber}</p>
                  {b.checkIn === phoneDay && <Badge tone="brand">Arriving</Badge>}{b.checkOut === phoneDay && <Badge tone="dirty">Leaving</Badge>}{b.checkIn < phoneDay && phoneDay < b.checkOut && <Badge tone="occ">Staying</Badge>}
                  {b.checkoutTaskId && <Badge tone="ready">Cleaning ✓</Badge>}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-3">{b.checkIn} → {b.checkOut} · {b.guests} guest{b.guests === 1 ? "" : "s"} · {formatMoney(b.total, currency)} · {b.source}{b.guestName ? ` · ${b.guestName}` : ""}{b.reference ? ` · ref ${b.reference}` : ""}</p>
                {canEdit && <div className="mt-2 flex flex-wrap gap-1.5"><Button size="sm" variant="secondary" onClick={() => openEdit(b)}>Edit</Button>{!b.checkoutTaskId && <Button size="sm" onClick={() => void act(b.id, "checkout")}>Checked out</Button>}</div>}
              </Card></li>
            ))}
          </ul>
        )}
      </div>

      {/* All upcoming bookings (desktop helper list for edit/cancel/checkout) */}
      <Card className="mt-4 hidden p-5 md:block">
        <h2 className="text-[15px] font-semibold">Upcoming &amp; current bookings</h2>
        {active.filter((b) => b.checkOut >= todayStr()).length === 0 ? <p className="mt-2 text-[13px] text-ink-3">No current or upcoming bookings. Tap + in the calendar or New booking.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {active.filter((b) => b.checkOut >= todayStr()).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <p className="min-w-0 flex-1 text-[13.5px]"><strong>Room {b.roomNumber}</strong> · {b.checkIn} → {b.checkOut} · {nightsBetween(b.checkIn, b.checkOut)} night{nightsBetween(b.checkIn, b.checkOut) === 1 ? "" : "s"} · {formatMoney(b.total, currency)} · {b.source}{b.guestName ? ` · ${b.guestName}` : ""}{b.checkoutTaskId ? " · cleaning task ✓" : ""}</p>
                {canEdit && <><Button size="sm" variant="secondary" onClick={() => openEdit(b)}>Edit</Button>{!b.checkoutTaskId && <Button size="sm" onClick={() => void act(b.id, "checkout")}>Checked out</Button>}<Button size="sm" variant="danger" onClick={() => void act(b.id, "cancel")}>Cancel</Button></>}
              </li>
            ))}
          </ul>
        )}
        {bookings.some((b) => b.status === "cancelled") && <p className="mt-2 text-[12.5px] text-ink-3">{bookings.filter((b) => b.status === "cancelled").length} cancelled booking(s) kept for history — they do not block rooms.</p>}
      </Card>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-brand-950/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={form.id ? "Edit booking" : "New booking"}>
          <Card className="w-full max-w-lg p-5">
            <h2 className="font-display text-[19px] font-semibold">{form.id ? "Edit booking" : "New booking"}</h2>
            {form.id && bookings.find((b) => b.id === form.id)?.checkoutTaskId && <p className="mt-1 text-[12.5px] font-semibold text-ready-deep">Cleaning task already created for check-out ✓</p>}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Room">
                <select className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={form.roomId} onChange={(e) => { const room = rooms.find((r) => r.id === e.target.value); setForm({ ...form, roomId: e.target.value, price: String(room?.pricePerNight || "") }); }} aria-label="Room">
                  {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} · {r.roomType} · {formatMoney(r.pricePerNight, currency)}/night</option>)}
                </select>
              </Field>
              <Field label="Guests"><Input type="number" min={1} max={20} value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} /></Field>
              <Field label="Check-in"><Input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} /></Field>
              <Field label="Check-out"><Input type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} /></Field>
              <Field label={`Price per night (${currency})`} hint={formRoom ? `Room price is ${formatMoney(formRoom.pricePerNight, currency)} — you can change it for this booking.` : undefined}><Input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
              <Field label="Source (just a label)"><select className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} aria-label="Source">{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Guest name (optional)"><Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Only hotel staff see this" /></Field>
              <Field label="Booking reference (optional)"><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="e.g. BK-1234" /></Field>
            </div>
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[13.5px] font-semibold text-brand-800">{formNights} night{formNights === 1 ? "" : "s"} × {formatMoney(Number(form.price) || 0, currency)} = {formatMoney(formTotal, currency)} total</p>
            <p className="mt-1 text-[12px] text-ink-3">Guest name and reference are never sent to the AI and never appear in reports.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button loading={busy} disabled={!formRoom} onClick={() => void save()}>{form.id ? "Save booking" : "Add booking"}</Button>
              <Button variant="secondary" disabled={busy} onClick={() => setForm(null)}>Back</Button>
              {form.id && <Button variant="danger" disabled={busy} onClick={() => void act(form.id!, "cancel")}>Cancel booking</Button>}
              {form.id && !bookings.find((b) => b.id === form.id)?.checkoutTaskId && <Button disabled={busy} onClick={() => void act(form.id!, "checkout")}>Checked out</Button>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
