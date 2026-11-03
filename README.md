# Readybell — one app to run your whole hotel, with AI built in

Readybell puts guests, staff, rooms, bookings and owner reports in one app: guests ask by chat or voice, AI sends each job to the right team, staff prove the work with photos, and the owner gets a checked daily brief.

**[Live demo](https://readybell.vercel.app)** · **Demo video:** _placeholder — link to be added_ · **Demo accounts** (all password `demo1234`): `owner`, `supervisor`, `aigerim`, `ruslan`, `daniyar`, `madina`

## Try it in 2 minutes

1. **Guest asks for towels** — open the [room 204 guest page](https://readybell.vercel.app/r/204) and ask for towels. The request becomes a task for Housekeeping.
2. **AI photo check** — sign in as `aigerim`, open the room 205 cleaning task, choose **Use a sample photo**, then run **AI photo check**. Compare the result with the room's perfect photo.
3. **Owner reports** — sign in as `owner` and open **Reports** for the daily/weekly brief.

No setup, no API key, and no real guest data are needed for the live demo.

## What it does

- **Guest assistant** — answers guests by text or voice in their language, using the hotel's own info.
- **Task routing** — one guest message can become several tasks, each sent to the right team (housekeeping, maintenance, front desk, room service) with a priority.
- **Talk to a person** — when a guest needs a human, or the AI cannot answer, the chat is handed to the front desk.
- **Photo-proof cleaning** — cleaners add photos, AI checks them against the room's perfect photo, and a supervisor approves or sends the work back.
- **Owner reports** — daily and weekly reports on what happened, what needs attention, occupancy and revenue.
- **Run the hotel** — rooms and prices, bookings, a QR code for every room, team accounts and roles, and a full history of who did what.

## How Meta AI is used

All AI calls go from our server to the Meta Model API. Without a key the app runs in clearly marked MOCK mode; the live demo uses the real models below.

| Model | What it does in Readybell |
|---|---|
| `muse-spark-1.3` | Guest assistant: answers guest questions, and turns each request into routed tasks (team, task type, priority). Also gives a second, vision-based opinion in the cleaning photo check, comparing staff photos with the room's perfect photo. |
| `muse-voice-transcribe-1.0` | Turns a guest's voice message into text. The guest reads and can fix the text before sending — tasks are created only when they press Send. |
| `sam-3.1` | Finds objects in cleaning photos (for example bed, towels, pillow) as part of the AI photo check, reporting each item as found, not found, or not sure. |
| `muse-wonder-1.0` | Writes the owner's daily and weekly reports from the hotel's real task, booking and report facts. Every number in the report is checked against those facts before it is shown. |

## Human in control

AI suggests, people decide. The AI never approves cleaning, never closes a repair, and never acts on its own: staff accept and do the work, a supervisor approves or sends it back with a note, and the owner sees the result. Every step — guest message, task change, photo, AI check, approval — is logged in History.

## Architecture

```text
Guest / staff browser (phone or desktop)
            │
            ▼
  Next.js app on Vercel ──────► Meta Model API
  (pages + server API routes)    (Spark · Voice · SAM · Wonder)
            │
            ▼
  Supabase Postgres + private Storage (hotel data + private photos)
```

Locally the same app can run without a database or API key, using local files and MOCK AI (see the local guide below).

## Security and privacy

- **Signed sessions** — sign-ins are signed, httpOnly cookies (12 hours); passwords for real team accounts are stored as scrypt hashes.
- **Role checks on the server** — every API route checks the signed-in person's role and team; staff only see and change their own team's tasks, and only supervisors/owners can approve work.
- **Guest token** — each room's QR code carries its own token, so a guest link opens only that room; guests see only the tasks from their own message.
- **Rate limits and a daily AI cap** — key endpoints are rate-limited, and real AI calls stop at a daily limit (`AI_DAILY_LIMIT`, default 500), after which answers are clearly marked MOCK.
- **Private photos** — staff photos live in a private Supabase Storage bucket and are only served to signed-in staff; photo checks send photos to the Meta Model API from the server, never from the browser.
- **No real guest data** — the demo uses only synthetic (fake) hotel data. No real guest names, phones, passports or payments. API keys live only in server environment settings, never in code.

## Known limits

- This is a hackathon demo with shared demo accounts (`demo1234`) — not a production sign-in setup for a real hotel.
- The microphone needs HTTPS or `localhost`, and voice transcription needs a real Meta API key; typing works everywhere.
- AI can be unsure: low-confidence photo results are shown as "not sure", never as pass or fail, and a person makes the final call.
- In local (no-database) mode, data stays on that one computer in a `.data` folder and is not shared or backed up.

## Provenance

Built during the Meta Global AI Developer Hackathon (2026). The UI design — colors, fonts, buttons, cards and badges — is ported from our earlier v1.2 prototype; shared pieces live in `src/components/ui.tsx` and tokens in `src/app/globals.css`. Demo room photos in `public/demo` are CC0 / CC BY-SA images from Wikimedia Commons (details in [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)).

---

**Run it on your computer:** see [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) — fresh clone, `npm install`, `npm run dev`, no database or API key needed (MOCK mode is clearly marked). Checks: `npm run typecheck` and `npm run build`.
