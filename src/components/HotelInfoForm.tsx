"use client";
import { useState } from "react";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import type { FaqItem, HotelInfo } from "@/lib/hotel-data";

const TEXT_FIELDS: Array<{ key: keyof HotelInfo; label: string; hint?: string }> = [
  { key: "hotelName", label: "Hotel name", hint: "Shown to guests at the top of their page." },
  { key: "address", label: "Address" },
  { key: "receptionPhone", label: "Reception phone" },
  { key: "emergencyNumber", label: "Emergency number", hint: "Guests are told to call this in an emergency." },
  { key: "wifiName", label: "Wi-Fi name" },
  { key: "wifiPassword", label: "Wi-Fi password" },
  { key: "checkIn", label: "Check-in time", hint: "For example 14:00" },
  { key: "checkOut", label: "Check-out time", hint: "For example 12:00" },
  { key: "breakfastHours", label: "Breakfast hours", hint: "For example 07:00–10:30" },
];

export default function HotelInfoForm({ initial }: { initial: HotelInfo }) {
  const [info, setInfo] = useState<HotelInfo>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newQ, setNewQ] = useState(""); const [newA, setNewA] = useState("");

  function set(key: keyof HotelInfo, value: string) { setInfo((p) => ({ ...p, [key]: value })); setSaved(false); }

  async function save(next: HotelInfo = info) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/hotel-info", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const data = await res.json().catch(() => ({})) as { error?: string; hotelInfo?: HotelInfo };
      if (!res.ok || !data.hotelInfo) throw new Error(data.error || "Could not save. Please try again.");
      setInfo(data.hotelInfo); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  function updateFaq(id: string, patch: Partial<FaqItem>) {
    setInfo((p) => ({ ...p, faqs: p.faqs.map((f) => (f.id === id ? { ...f, ...patch } : f)) })); setSaved(false);
  }

  return (
    <div>
      {saved && <div className="mb-3 rounded-xl bg-ready-soft px-3.5 py-3 text-[13.5px] font-semibold text-ready-deep" role="status">Saved ✓ The guest AI will use this info now.</div>}
      {error && <div className="mb-3 rounded-xl bg-dirty-soft px-3.5 py-3 text-[13.5px] text-dirty-deep" role="alert">{error}</div>}
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Hotel facts</h2>
        <p className="mt-1 text-[13px] text-ink-3">The guest assistant answers hotel questions only from this sheet. If an answer is not here, it will not guess — it asks the front desk instead.</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEXT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}><Input value={String(info[f.key])} onChange={(e) => set(f.key, e.target.value)} /></Field>
          ))}
        </div>
        <Field label="House rules" className="mt-3"><Textarea value={info.houseRules} onChange={(e) => set("houseRules", e.target.value)} rows={3} /></Field>
        <Button className="mt-4" size="lg" loading={busy} onClick={() => void save()}>Save hotel info</Button>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Extra questions &amp; answers</h2>
        <p className="mt-1 text-[13px] text-ink-3">Add answers guests often ask about — parking, pets, late check-out. The assistant will use these exact answers.</p>
        {info.faqs.length === 0 ? (
          <p className="mt-3 rounded-xl bg-canvas px-3.5 py-3 text-[13.5px] text-ink-3">No extra questions yet. Add the first one below — for example “Is parking free?” → “Parking is free in front of the hotel.”</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {info.faqs.map((faq) => (
              <li key={faq.id} className="rounded-xl border border-line p-3">
                <Field label="Question"><Input value={faq.question} onChange={(e) => updateFaq(faq.id, { question: e.target.value })} /></Field>
                <Field label="Answer" className="mt-2"><Textarea value={faq.answer} onChange={(e) => updateFaq(faq.id, { answer: e.target.value })} rows={2} /></Field>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" loading={busy} onClick={() => void save()}>Save</Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => { if (window.confirm("Delete this question and answer?")) { const next = { ...info, faqs: info.faqs.filter((f) => f.id !== faq.id) }; setInfo(next); void save(next); } }}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-line pt-3 grid grid-cols-1 gap-2">
          <Field label="New question"><Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Is parking free?" /></Field>
          <Field label="Its answer"><Textarea value={newA} onChange={(e) => setNewA(e.target.value)} rows={2} placeholder="Parking is free in front of the hotel." /></Field>
          <div><Button disabled={busy || !newQ.trim() || !newA.trim()} onClick={() => { const next = { ...info, faqs: [...info.faqs, { id: crypto.randomUUID(), question: newQ.trim(), answer: newA.trim() }] }; setInfo(next); setNewQ(""); setNewA(""); void save(next); }}>Add question &amp; answer</Button></div>
        </div>
      </Card>
    </div>
  );
}
