# hotelapp-liveops

AI operations layer for hotels: guest voice messages and staff photos become routed, verified tasks. And More. Meta AI Hackathon 2026.

## What works today

- `/r/204` — guest page for room 204: write a request, press Send.
- `POST /api/guest/message` — turns the guest text into tasks:
  department (`maintenance` / `housekeeping` / `front_desk` / `room_service`),
  title, priority (`high` / `medium` / `low`), confidence (0 to 1).
  One message can create 2 tasks, e.g. "leak in the bathroom and bring towels".
- With no API key, the app uses a fake MOCK answer and shows the word **MOCK**.
- Every created task is saved in `.data/tasks.json` (local only, ignored by git).
- `/staff` — staff screen. Choose who you are (Ruslan - Maintenance,
  Aigerim - Housekeeping, Daniyar - Front desk, Madina - Room service).
  You see only your team tasks, most urgent and newest first, and move them
  with buttons: Accept -> Start -> Done.
- After Send, the guest page shows only the tasks created by that one
  message, like "Sent to Maintenance: Fix leak", with a simple live status
  (Received / On the way / Done) that refreshes every few seconds.
  Guests never see older tasks from the room (privacy), and a page refresh
  starts clean. All tasks stay visible on `/staff`.
- Photo proof on staff tasks: after pressing **Start**, staff add 1–3
  photos with **Add photo** (on a phone it opens the camera; on desktop it
  opens a file picker). Photos show on the task, open full size on click,
  and can be deleted with the × on the photo. Photo files are saved locally
  in `.data/photos` (ignored by git) and survive a server restart; only the
  photo link is saved on the task. All photo saving/reading lives in
  `src/lib/photos.ts`, so it can switch to cloud storage later by changing
  only that file.
- `/staff` has a small "Reset demo data" link at the bottom that deletes
  all saved tasks and their photos (it asks "Are you sure?" first).
- Voice input on the guest page: press **Mic**, speak (up to 45 seconds),
  press **Stop**. The recording is turned into text by Meta's
  `muse-voice-transcribe-1.0` and put into the text box. The guest can
  read and fix the text, then press **Send** — tasks are created only
  then, like with typed text. The language is detected automatically.
  If the microphone is blocked, the page says so and typing still works.
- Pages are responsive: one column on phones (from 375px), wider layouts
  with status columns on desktop (up to 1440px).

## How to run it

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open in your browser:

- Guest (room 204): http://localhost:3000/r/204
- Staff: http://localhost:3000/staff

Try this text:

> There is a leak in the bathroom and please bring towels

Then go to the staff page, choose Ruslan (Maintenance), and press
Accept -> Start -> Done on the leak task. Watch the guest page: its status
updates by itself in a few seconds.

## Try voice input

1. Open http://localhost:3000/r/204 in Chrome.
2. Press **Mic**. If Chrome asks, allow the microphone.
3. Say: "There is a leak in the bathroom. Please bring towels."
4. Press **Stop**. Wait a few seconds.
5. The text appears in the text box with the hint
   "Check the text and fix it if needed, then press Send."
   Fix any wrong words if you want.
6. Press **Send**. Only now are the tasks created below.

Note for phones: Chrome on a phone only allows the microphone on secure
(HTTPS) pages or localhost. Opening the Mac's network address
(http://192.168...) on a phone will block the microphone. Typing works
everywhere. For a real phone test you need an HTTPS address (for example a
tunnel) — ask for help if you want that set up.

## Using the real AI (optional)

1. Copy `.env.example` to `.env.local`.
2. Put your key in `.env.local`:

```text
MODEL_API_KEY=your_key_here
```

3. Restart `npm run dev`.

The server calls the Meta Model API (`https://api.meta.ai/v1`, model
`muse-spark-1.3`). The key is read only on the server from `.env.local`.
Never put the key in code and never commit `.env.local`.

Without a key, the page still works in MOCK mode.

## Checks

```bash
npm run typecheck
npm run build
```
