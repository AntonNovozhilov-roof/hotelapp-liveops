"use client";
import { useState } from "react";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import type { FaqItem, HotelInfo, RecommendationItem } from "@/lib/hotel-data";

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

const CURRENCIES = ["USD", "EUR", "GBP", "KZT", "AED", "TRY", "RUB", "CNY"];

export default function HotelInfoForm({ initial, initialCurrency = "USD", initialAiPhotoCheckEnabled = true, initialCleanerPhotoRequired = true, initialConversationRetentionDays = 7 }: { initial: HotelInfo; initialCurrency?: string; initialAiPhotoCheckEnabled?: boolean; initialCleanerPhotoRequired?: boolean; initialConversationRetentionDays?: number }) {
  const [info, setInfo] = useState<HotelInfo>(initial);
  const [currency, setCurrency] = useState(initialCurrency);
  const [retentionDays, setRetentionDays] = useState(initialConversationRetentionDays);
  const [aiOn, setAiOn] = useState(initialAiPhotoCheckEnabled);
  const [photoRequired, setPhotoRequired] = useState(initialCleanerPhotoRequired);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  async function saveCleaningSetting(patch: { aiPhotoCheckEnabled?: boolean; cleanerPhotoRequired?: boolean }) {
    setError(null); setSettingsMsg(null);
    try {
      const res = await fetch("/api/rooms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; settings?: { aiPhotoCheckEnabled: boolean; cleanerPhotoRequired: boolean } };
      if (!res.ok || !data.settings) throw new Error(data.error || "Could not save the setting.");
      setAiOn(data.settings.aiPhotoCheckEnabled); setPhotoRequired(data.settings.cleanerPhotoRequired);
      setSettingsMsg("Saved ✓ (also on the Rooms → Perfect photos tab)");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the setting."); }
  }
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newQ, setNewQ] = useState(""); const [newA, setNewA] = useState("");
  const [newRecTitle, setNewRecTitle] = useState(""); const [newRecNote, setNewRecNote] = useState("");

  function set(key: keyof HotelInfo, value: string) { setInfo((p) => ({ ...p, [key]: value })); setSaved(false); }

  async function save(next: HotelInfo = info) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/hotel-info", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, currency, conversationRetentionDays: retentionDays }) });
      const data = await res.json().catch(() => ({})) as { error?: string; hotelInfo?: HotelInfo; currency?: string; conversationRetentionDays?: number };
      if (!res.ok || !data.hotelInfo) throw new Error(data.error || "Could not save. Please try again.");
      setInfo(data.hotelInfo); if (data.currency) setCurrency(data.currency); if (data.conversationRetentionDays) setRetentionDays(data.conversationRetentionDays); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  function updateFaq(id: string, patch: Partial<FaqItem>) {
    setInfo((p) => ({ ...p, faqs: p.faqs.map((f) => (f.id === id ? { ...f, ...patch } : f)) })); setSaved(false);
  }
  function updateRec(id: string, patch: Partial<RecommendationItem>) {
    setInfo((p) => ({ ...p, recommendations: p.recommendations.map((f) => (f.id === id ? { ...f, ...patch } : f)) })); setSaved(false);
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
        <div className="mt-3 max-w-xs">
          <Field label="Currency" hint="Used for room prices, bookings and reports everywhere."><select className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={currency} onChange={(e) => { setCurrency(e.target.value); setSaved(false); }} aria-label="Currency">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="House rules" className="mt-3"><Textarea value={info.houseRules} onChange={(e) => set("houseRules", e.target.value)} rows={3} /></Field>
        <Button className="mt-4" size="lg" loading={busy} onClick={() => void save()}>Save hotel info</Button>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">General information</h2>
        <p className="mt-1 text-[13px] text-ink-3">About the hotel, the area, the style — anything you want guests to know. The guest assistant uses this when guests ask what the hotel and the neighbourhood are like.</p>
        <Field label="General information" className="mt-3"><Textarea value={info.generalInfo} onChange={(e) => set("generalInfo", e.target.value)} rows={5} maxLength={4000} placeholder="For example: A small hotel in central Paris, in a quiet street near the river. Family-run, with a small garden…" /></Field>
        <Button className="mt-4" size="lg" loading={busy} onClick={() => void save()}>Save hotel info</Button>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Our recommendations</h2>
        <p className="mt-1 text-[13px] text-ink-3">Your own tips: restaurants, cafés, sights, pharmacy, transport. When a guest asks what to do nearby, the guest assistant suggests these first.</p>
        {info.recommendations.length === 0 ? (
          <p className="mt-3 rounded-xl bg-canvas px-3.5 py-3 text-[13.5px] text-ink-3">No recommendations yet. Add the first one below — for example “Café Lumière” → “Our favourite café, two streets away. Great croissants.”</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {info.recommendations.map((rec) => (
              <li key={rec.id} className="rounded-xl border border-line p-3">
                <Field label="Name or place"><Input value={rec.title} onChange={(e) => updateRec(rec.id, { title: e.target.value })} /></Field>
                <Field label="Why you recommend it" className="mt-2"><Textarea value={rec.note} onChange={(e) => updateRec(rec.id, { note: e.target.value })} rows={2} /></Field>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" loading={busy} onClick={() => void save()}>Save</Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => { if (window.confirm("Delete this recommendation?")) { const next = { ...info, recommendations: info.recommendations.filter((f) => f.id !== rec.id) }; setInfo(next); void save(next); } }}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-line pt-3 grid grid-cols-1 gap-2">
          <Field label="New recommendation"><Input value={newRecTitle} onChange={(e) => setNewRecTitle(e.target.value)} placeholder="Café Lumière" /></Field>
          <Field label="Why you recommend it"><Textarea value={newRecNote} onChange={(e) => setNewRecNote(e.target.value)} rows={2} placeholder="Our favourite café, two streets away. Great croissants." /></Field>
          <div><Button disabled={busy || !newRecTitle.trim()} onClick={() => { const next = { ...info, recommendations: [...info.recommendations, { id: crypto.randomUUID(), title: newRecTitle.trim(), note: newRecNote.trim() }] }; setInfo(next); setNewRecTitle(""); setNewRecNote(""); void save(next); }}>Add recommendation</Button></div>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Guest message privacy</h2>
        <p className="mt-1 text-[13px] text-ink-3">When a guest talks to a person, the chat text is kept only while the conversation is open and for this long after it closes — then it is deleted. It is never used in reports.</p>
        <div className="mt-3 max-w-xs">
          <Field label="Keep closed chat text for"><select className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm sm:h-10" value={retentionDays} onChange={(e) => { setRetentionDays(Number(e.target.value)); setSaved(false); }} aria-label="Keep closed chat text for">{[1, 7, 30].map((d) => <option key={d} value={d}>{d} {d === 1 ? "day" : "days"}</option>)}</select></Field>
        </div>
        <Button className="mt-4" size="lg" loading={busy} onClick={() => void save()}>Save hotel info</Button>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Cleaning photo settings</h2>
        <p className="mt-1 text-[13px] text-ink-3">The same switches as on Rooms → Perfect photos. Turning the AI check off never deletes saved perfect photos.</p>
        {settingsMsg && <p className="mt-2 rounded-xl bg-ready-soft px-3 py-2 text-[12.5px] text-ready-deep" role="status">{settingsMsg}</p>}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-xl border border-line p-3.5"><input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={aiOn} onChange={(e) => void saveCleaningSetting({ aiPhotoCheckEnabled: e.target.checked })} /><span><strong className="text-[14px]">AI photo check for cleaning: {aiOn ? "On" : "Off"}</strong><br /><span className="text-[12.5px] text-ink-3">When off, no AI check runs and perfect photos are not used.</span></span></label>
          <label className="flex items-start gap-3 rounded-xl border border-line p-3.5"><input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={photoRequired} onChange={(e) => void saveCleaningSetting({ cleanerPhotoRequired: e.target.checked })} /><span><strong className="text-[14px]">Cleaners must add a photo: {photoRequired ? "On" : "Off"}</strong><br /><span className="text-[12.5px] text-ink-3">When off, cleaning can be sent to review with no photo.</span></span></label>
        </div>
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
