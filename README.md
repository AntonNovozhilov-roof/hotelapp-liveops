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
- With no API key, the app uses a fake MOCK answer and shows the word **MOCK** (a MOCK banner sits on every page).
- Fresh start (H1): the Owner sees **Load demo hotel** (Owner home, and on the empty Rooms & QR page) — one tap creates rooms 101–110 + 201–210, a sample hotel info sheet and sample tasks, all labelled demo and removed by **Reset demo data**.
- Every created task is saved in `.data/tasks.json` (local only, ignored by git).
- `/login` — demo sign-in. Accounts: **owner**, **supervisor**,
  **aigerim** (Housekeeping / cleaner), **ruslan** (Maintenance),
  **daniyar** (Front desk), **madina** (Room service). Every demo account
  uses the password **`demo1234`**, shown on the login page (tap a person
  to sign in as them). Real sign-up comes later with the database.
  After sign-in each person lands on their own screen: staff on their
  role screen (`My rooms`, `Repairs`, `Front desk`, `Room service
  orders`), the Supervisor on the review page (M7), and the Owner on a
  home page (the real morning report is M10). The Owner can also open
  and use the supervisor review page. Sign out is in the top bar.
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
- `/supervisor` — the review page (M7): cleaning tasks In review with
  room, who cleaned, photos (tap to enlarge), AI score and the one-line
  AI result. Order: AI "not found" / "not sure" first, then oldest.
  **Approve** is one tap (task Done, guest sees Done); **Send back**
  needs a short note (staff see it, task back to In progress). The
  Supervisor and the Owner can use it (server-checked). The page also
  keeps the **New cleaning task** form and **Finished repairs** with
  Reopen below the queue.
- Supervisor and Owner homes have a simple **New cleaning task** form:
  write a room number and it creates a "Clean room \<number\>" cleaning
  task for Housekeeping (for example after check-out). Guests can also
  ask for cleaning on the guest page. `POST /api/tasks` with
  `{"room":"204"}` does this (supervisor/owner only, server-checked).
- `/staff` — the signed-in staff member's screen. You see only your team
  tasks, urgent first then oldest first (same order in every column,
  shown under each column title), and move them with the buttons
  for their type (see above). **The server checks the role:**
  `PATCH /api/tasks/<id>` with `{"action":"approve"}` or
  `{"action":"send_back","note":"..."}` only works with a supervisor
  (or Owner) sign-in (staff get HTTP 403); the staff steps, photo upload and the AI
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
  cleaning task can only be sent to review after this check ran on the
  current photos (adding, deleting or retaking photos clears the old
  result). **Retake photos** (cleaning tasks only) clears all photos and
  the AI result in one tap, after a confirmation. With no
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

## Run it on your computer

For a non-developer tester. You do not need a database, an account, or an
API key to try everything. Allow about 10 minutes for the first setup.

### 1. Install Node.js

Install **Node.js 20 or newer** (the 22 LTS version from
[nodejs.org](https://nodejs.org) is a good choice):

- **macOS:** download the macOS installer from nodejs.org and run it, or
  with Homebrew: `brew install node@22`
- **Windows:** download the Windows Installer (.msi) from nodejs.org and
  run it. Tick nothing extra; the defaults are fine.

Close and reopen your terminal afterwards, then check it worked:

```bash
node -v   # should print v20... or v22...
npm -v
```

### 2. Get the code

Repo: https://github.com/AntonNovozhilov-roof/hotelapp-liveops

- **Easiest (GitHub Desktop):** install GitHub Desktop, sign in to GitHub,
  choose **File → Clone repository**, paste the repo link above, pick a
  folder, and click **Clone**.
- **Or with git** in a terminal:

```bash
git clone https://github.com/AntonNovozhilov-roof/hotelapp-liveops.git
cd hotelapp-liveops
```

### 3. Install and start

In a terminal **inside the project folder** (in GitHub Desktop: Repository
→ Open in Terminal):

```bash
npm install
npm run dev
```

Wait until it says the server is ready, then open
**http://localhost:3000** in your browser. Leave that terminal window open
while you test — closing it (or pressing Ctrl+C) stops the app.
If the terminal says "Port 3000 is in use … using available port 3001"
(the app was already running), open the address it prints instead, for
example http://localhost:3001 — or stop the other copy first with Ctrl+C
in its terminal.

No `.data` folder? That is normal on a fresh clone: the app creates it by
itself the first time it saves something. Never commit `.data` or
`.env.local` — both are ignored by git on purpose.

### 4. Sign in, load the demo hotel, try it

Demo accounts (password `demo1234` for every account — tap a person on
the sign-in page to sign in as them):

| Sign in as | Username | What you see |
|---|---|---|
| Owner | `owner` | Owner home, Reports, Rooms & QR, Hotel info |
| Supervisor | `supervisor` | Review cleaning work, Reports, History |
| Aigerim · Housekeeping | `aigerim` | My rooms |
| Ruslan · Maintenance | `ruslan` | Repairs |
| Daniyar · Front desk | `daniyar` | Front desk |
| Madina · Room service | `madina` | Room service orders |

1. Open http://localhost:3000/login and sign in as **Owner**.
2. On the Owner home press **Load demo hotel**. It creates demo rooms
   (floor 1: 101–110, floor 2: 201–210), a sample hotel info sheet and a
   few sample tasks. The same button is on the empty **Rooms & QR** page.
   Everything it creates is clearly labelled demo data with fake details.
3. Open a guest page, e.g. http://localhost:3000/r/204 (no sign-in needed),
   and send: *"There is a leak in the bathroom and please bring towels"*.
   That makes 2 tasks: a Repair for Ruslan and a Request for Aigerim.
4. Sign in as each person and move their task along: requests are
   Accept → Start → Done (no photo); repairs need a proof photo before
   Done; cleaning needs a photo + **Run AI photo check** → Send to review,
   then the Supervisor (or Owner) approves or sends it back on `/supervisor`.

**Reset / start again:** sign in as Owner → Owner home → **Reset demo
data** (it asks "Are you sure?"). It deletes all tasks and photos, rooms
and QR codes, the hotel info sheet, history and reports — a fresh start,
and you can load the demo hotel again.

### 5. MOCK mode (no API key) and real AI (optional)

With no API key the app still works fully in **MOCK mode**: a yellow MOCK
banner sits at the top of every page, and AI replies, photo checks and
reports are marked MOCK. Tasks, photos, review, reports and history all
really work — only the AI answers are simple examples, and voice
transcription is unavailable (type instead).

To switch on real AI with **your own** Meta API key:

1. In the project folder, copy `.env.example` to a new file `.env.local`.
2. Put your key in `.env.local` (and nothing else on that line):

```text
MODEL_API_KEY=your_key_here
```

3. Stop the app (Ctrl+C in its terminal) and start it again: `npm run dev`.

> **Never** commit `.env.local`, never paste your key into GitHub, Linear,
> chat, or a screenshot. The key is read only on the server. The server
> calls the Meta Model API (`https://api.meta.ai/v1`).

### 6. Try it on a phone on the same Wi-Fi

1. Connect the phone to the **same Wi-Fi** as the computer running the app.
2. Find the computer's local address:
   - **macOS:** System Settings → Wi-Fi → Details… → IP address (looks like
     `192.168.1.20`), or run `ipconfig getifaddr en0` in a terminal.
   - **Windows:** run `ipconfig` and look for the IPv4 address.
3. On the phone open `http://<computer-ip>:3000` (for example
   `http://192.168.1.20:3000`). If the page does not load, allow Node.js
   through the computer's firewall when it asks.

Photos work on the phone. **The microphone may not work there:** browsers
only allow the microphone on secure (HTTPS) pages or on `localhost`, and
this address is plain HTTP — typing works everywhere. Voice on a phone
needs an HTTPS address (for example a tunnel); ask for help if you want
that set up.

For voice on the **computer** itself: open http://localhost:3000/r/204 in
Chrome, press **Mic**, allow the microphone, speak (up to 45 seconds),
press **Stop**, check/fix the text, then press **Send** — tasks are only
created when you press Send.

### Known limits

- **Data is stored only on that computer**, in the `.data` folder next to
  the code. It is not shared, not backed up, and another computer that
  clones the repo starts empty.
- **Sign-in resets when the app restarts:** sessions live in server memory,
  so restarting `npm run dev` signs everyone out. Sign in again.
- Demo accounts and the `demo1234` password are for local testing only.
- The microphone needs HTTPS or `localhost` (see above), and voice
  transcription also needs a real `MODEL_API_KEY`.
- This is a local test build, not the online version: do not put real
  guest names, phones, passports or payments into it.

## Checks

```bash
npm run typecheck
npm run build
```
