# hotelapp-liveops

AI operations layer for hotels: guest voice messages and staff photos become routed, verified tasks. And More. Meta AI Hackathon 2026.

> Look and feel: the design (colors, fonts, buttons, cards, badges) is
> ported from our earlier v1.2 prototype. Shared pieces live in
> `src/components/ui.tsx`; color/font tokens live in `src/app/globals.css`.

## What works today

- `/r/204` — guest page for room 204: write a request, press Send.
- `POST /api/guest/message` — turns the guest text into tasks:
  department (`maintenance` / `housekeeping` / `front_desk` / `room_service`),
  title, priority (`high` / `medium` / `low`), confidence (0 to 1).
  One message can create 2 tasks, e.g. "leak in the bathroom and bring towels".
- With no API key, the app uses a fake MOCK answer and shows the word **MOCK**.
- Every created task is saved in `.data/tasks.json` (local only, ignored by git).
- `/login` — demo sign-in. Accounts: **owner**, **supervisor**,
  **aigerim** (Housekeeping / cleaner), **ruslan** (Maintenance),
  **daniyar** (Front desk), **madina** (Room service). Every demo account
  uses the password **`demo1234`**, shown on the login page (tap a person
  to sign in as them). Real sign-up comes later with the database.
  After sign-in each person lands on their own screen: staff on their
  role screen (`My rooms`, `Repairs`, `Front desk`, `Room service
  orders`), the Supervisor and Owner on simple home pages for now (their
  real pages are M7 and M10). Sign out is in the top bar.
- Task types (T1): the AI picks a **type** as well as the department, and
  the type is shown on every task card. The rules live in one place,
  `src/lib/task-types.ts`:
  - **Request** (towels, water, pillow, taxi, food, info): Accept ->
    Start -> Done. No photo, no review.
  - **Cleaning** (clean a room): Accept -> Start -> photo -> AI photo
    check -> Send to review -> supervisor approves (Done) or sends it
    back with a note.
  - **Repair** (fix something): Accept -> Start -> proof photo -> Done.
    No AI check. The photo stays on the done task so the Supervisor and
    Owner can see it on their home pages; the Supervisor can **Reopen**
    a repair with a note and Ruslan fixes it again.
  Old saved tasks without a type get one guessed from their title
  (otherwise "request").
- Supervisor and Owner homes have a simple **New cleaning task** form:
  write a room number and it creates a "Clean room \<number\>" cleaning
  task for Housekeeping (for example after check-out). Guests can also
  ask for cleaning on the guest page. `POST /api/tasks` with
  `{"room":"204"}` does this (supervisor/owner only, server-checked).
- `/staff` — the signed-in staff member's screen. You see only your team
  tasks, most urgent and newest first, and move them with the buttons
  for their type (see above). **The server checks the role:**
  `PATCH /api/tasks/<id>` with `{"action":"approve"}` or
  `{"action":"send_back","note":"..."}` only works with a supervisor
  sign-in (staff get HTTP 403); the staff steps, photo upload and the AI
  check only work for the task's own team; **Reset demo data**
  (`DELETE /api/tasks`, button on the Owner home) only works for the
  Owner. The guest page and guest APIs stay open without sign-in.
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
- AI photo check on **cleaning tasks only** (SAM 3.1): on a started
  cleaning task with photos, press **Run AI photo check**. The server
  sends the photo(s) to Meta's `sam-3.1` (one short object search per
  check — housekeeping looks for bed, towels, pillow; the list lives in
  `src/lib/photo-check.ts`) and saves the result on the task: a score
  (0–100), each check as Found / Not found / Not sure (with the AI
  confidence; low confidence is always "Not sure", never pass or fail),
  one short problem line (e.g. "Not found: towels. Fix the room and take
  a new photo."), and the model name. The AI only helps the supervisor —
  it never approves a task, and the task status does not change. A
  cleaning task can only be sent to review after this check ran. With no
  API key, or when the model errors, the saved result is clearly marked
  **MOCK** and the flow still works. API: `POST /api/tasks/<id>/ai-check`
  (refused for request/repair tasks).
- The Owner home has a "Reset demo data" button that deletes all saved
  tasks and their photos (it asks "Are you sure?" first). Owner only.
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
- Sign in: http://localhost:3000/login (demo accounts, password `demo1234`)

Try this text:

> There is a leak in the bathroom and please bring towels

That message makes 2 tasks: a **Repair** for Ruslan (Maintenance) and a
**Request** for Aigerim (Housekeeping). Sign in as Aigerim and press
Accept -> Start -> Done on the towels task — no photo needed. Sign in as
Ruslan and press Accept -> Start on the leak task, add a proof photo,
then Done — no AI check, no review; the guest page then shows "Done".
To try cleaning: sign in as the Supervisor or Owner, use **New cleaning
task** with a room number, then as Aigerim press Accept -> Start, add a
photo, Run AI photo check, Send to review — and as the Supervisor
approve it with the API above (`{"action":"approve"}`) until the real
supervisor screen comes in M7.

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
