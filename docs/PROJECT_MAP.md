# HotelApp LiveOps — Project Map

Date: 2026-10-31. Deadline for one full working loop: **4 Nov 2026**.
Design source (read only): `/Users/batyr/Documents/hotelapp/hotelapp-v1.2`
(`README.md`, `docs/API.md`, screens in `src/pages/app`, `src/pages/staff`, `src/pages/guest`).
This file is the plan. It is not a copy of the v1.2 design — it says what we
build **here**, in this repo, and in what order.

## What the app is (3 sentences)

HotelApp LiveOps turns a hotel guest's words (typed or spoken) into tasks for
the right hotel team, using Meta AI. Staff do the work, prove it with a photo,
and AI checks the photo before a supervisor approves it. The owner gets a
short morning report, and every step is saved in a history of who did what
and when.

## The full path (one working loop)

```text
Guest request
  (room QR page, typed text or voice)
        |
        v
AI tasks
  (Meta muse-spark-1.3 turns one message into 1+ tasks:
   department, title, priority, confidence)
        |
        v
Staff does the job
  (staff board: Accept -> Start -> work)
        |
        v
Photo proof
  (staff takes/uploads a photo of the finished job)
        |
        v
AI photo check (SAM 3.1)
  (score + list of problems, saved on the task)
        |
        v
Supervisor approves or sends back
  (approve -> Done; send back -> staff fixes and sends a new photo)
        |
        v
Owner morning report (Muse Wonder)
  (short text: yesterday done, open problems, urgent items)
        |
        v
History
  (who did what and when, for every task)
```

Everything in the loop must work online over HTTPS, and saved tasks and
photos must survive a server restart.

## Blocks

### 1. Guest

**Done**
- Room page `/r/204` (also works for other rooms as `/r/<room>`): text box,
  Send button, Mic button (record up to 45 s, stop, transcript goes into the
  text box first so the guest can fix it, then Send).
- Guest sees only a short confirmation for the message they just sent
  ("Sent to Maintenance: ...") with a live status. No room history (privacy).
- Fake (synthetic) data only. Responsive (phone from 375 px, desktop to 1440 px).

**Left**
- v1.2 guest page has more screens: food menu, items list (towels, pillows),
  problem types, hotel info, AI chat in EN/RU/KK. Those are LATER (see below).
- Signed QR token (v1.2: `/g/:room?t=...`, so guests cannot guess other
  rooms). SHOULD.

**Files**
- `src/app/r/[room]/page.tsx`, `src/app/r/[room]/GuestForm.tsx`
- v1.2 design: `src/pages/guest/GuestPage.tsx` in the design folder

### 2. AI triage

**Done**
- `POST /api/guest/message`: sends guest text to Meta Model API
  (`https://api.meta.ai/v1`, model `muse-spark-1.3`), gets JSON tasks
  (department / title / priority / confidence), checks the shape, saves them.
- `POST /api/guest/transcribe`: Meta speech-to-text
  (`muse-voice-transcribe-1.0`, `POST /v1/asr/transcribe`, WAV only — the
  browser converts the recording to WAV 24 kHz). Language is detected
  automatically (Meta returns no language field, so the app guesses from the
  text when needed).
- No API key = MOCK mode with a clear MOCK badge. Key only in `.env.local`.

**Left**
- Low-confidence tasks (< 0.7) are not marked for a human check yet. SHOULD.
- The v1.2 design has an AI guest chat (answers first, unanswered questions
  go to the front desk) and AI settings (which model for which job). LATER.

**Files**
- `src/app/api/guest/message/route.ts`, `src/app/api/guest/transcribe/route.ts`
- `src/lib/tasks.ts`, `src/lib/language.ts`

### 3. Tasks

**Done**
- A task has: id, room, department, title, priority, confidence, status
  (new / accepted / in_progress / done), created/updated times.
- Tasks are saved in a local JSON file `.data/tasks.json`.
- `GET /api/tasks` (filter by room, department, or task IDs),
  `PATCH /api/tasks/[id]` (only New -> Accepted -> In progress -> Done),
  `DELETE /api/tasks` (demo reset).
- One guest message can make several tasks.

**Left**
- The JSON file does not survive real hosting (see Online block). MUST: move
  to a real database, keep the same API shape.
- The loop needs one more status: **review** (staff sent photo proof,
  waiting for the supervisor). MUST.
- v1.2 has more task kinds (cleaning tasks from check-outs, repair tickets,
  planned maintenance). The MVP loop uses our one task type for every team.

**Files**
- `src/lib/tasks.ts`, `src/lib/store.ts`
- `src/app/api/tasks/route.ts`, `src/app/api/tasks/[id]/route.ts`

### 4. Staff

**Done**
- `/staff`: choose who you are (Ruslan – Maintenance, Aigerim –
  Housekeeping, Daniyar – Front desk, Madina – Room service). Each person
  sees only their team tasks, most urgent then newest first.
- Columns New / Accepted / In progress / Done on desktop, one column on the
  phone. Red badge with the number of NEW tasks on each person box (hidden
  at 0, updates automatically). Buttons Accept -> Start -> Done.
- "Reset demo data" link at the bottom (asks "Are you sure?" first).

**Left**
- Staff must add **photo proof** and send the task **to review** instead of
  finishing it directly. MUST (Photo proof block).
- The board must show the AI photo result and the supervisor's answer
  (approved / sent back with a note). MUST.
- v1.2 staff app has cleaning checklists, "my rooms" lists, repair reports,
  arrivals. Checklist is SHOULD; the rest is LATER.

**Files**
- `src/app/staff/page.tsx`, `src/app/staff/StaffBoard.tsx`

### 5. Photo proof

**Done**
- Nothing yet. This is the biggest missing part of the loop.

**Left (all MUST)**
- Staff uploads 1–3 photos on a started task (phone camera works:
  file input with `capture`).
- Photos are saved so they survive restarts (object storage or database —
  decided in the storage task), and the photo URLs live on the task.
- Staff can retake (delete photos and the AI result, like v1.2 `retake`).

**Files (new)**
- `src/app/api/tasks/[id]/photos/route.ts`, photo field in `src/lib/store.ts`
- Photo UI in `src/app/staff/StaffBoard.tsx` (or a per-task panel there)

### 6. AI photo check (SAM 3.1)

**Done**
- Nothing yet. In v1.2 the design only says "the model set for the job
  photo" returns `{ score, issues[], model }` (`docs/API.md`,
  `tasks.aiCheck`). The model named for this step in our plan is SAM 3.1.

**Left (all MUST)**
- First check the official Meta docs for the exact SAM 3.1 endpoint and
  request format on the Meta Model API. Do not guess the wire format.
- `POST /api/tasks/[id]/ai-check`: send the task photo(s), save
  `{ score, issues, model }` on the task. If there is no key (or the model
  is not available), use a clearly marked MOCK result so the loop still runs.
- Show score + issues to staff; if there are issues, staff fixes the job and
  retakes the photo (see Photo proof).

**Files (new)**
- `src/app/api/tasks/[id]/ai-check/route.ts`, AI result field in
  `src/lib/tasks.ts` / `src/lib/store.ts`, result UI in `StaffBoard.tsx`

### 7. Supervisor

**Done**
- Nothing yet. Today staff press Done themselves — there is no check by a
  second person.

**Left (all MUST)**
- New page `/supervisor`: tasks in **review**, with photo(s), AI score and
  issues, room, title, who did it.
- Two buttons: **Approve** (task -> done; guest sees Done) and
  **Send back** (task -> in_progress, with a short note staff can see;
  guest stays "On the way").
- Simple person picker at the top, same style as staff (no login in the
  MVP). Queue sorted with the lowest AI score first (like v1.2 Review).

**Files (new)**
- `src/app/supervisor/page.tsx`, `src/app/supervisor/SupervisorBoard.tsx`
- Status changes reuse `PATCH /api/tasks/[id]`

### 8. Owner report

**Done**
- Nothing yet. In v1.2, the morning briefing is written by the "briefing"
  AI job and sent at about 07:30–08:00 (`docs/API.md`: `GET
  /dashboard/briefing`, guest names removed).

**Left (MUST for a simple version)**
- New page `/owner` with a **Generate morning report** button.
- `POST /api/report/morning`: builds facts from saved tasks and history
  (done yesterday, still open, urgent, sent back, average AI photo score),
  then asks the Meta model **Muse Wonder** (check the exact model id on the
  Meta Model API first) to write a short, plain report. No guest personal
  data in the prompt (we have none anyway). No key = clearly marked MOCK
  report built from the same facts.
- SHOULD: download the report as a text/Markdown file. Sending it to
  Telegram/WhatsApp is LATER.

**Files (new)**
- `src/app/owner/page.tsx`, `src/app/api/report/morning/route.ts`

### 9. History

**Done**
- Each task has `createdAt` / `updatedAt` only. There is no list of events
  and no "who" on any step.

**Left (MUST)**
- Save one history event for every step: created, accepted, started, photo
  added, AI check (score), sent to review, approved, sent back (with note),
  done. Each event: task id, action, person (staff/supervisor name chosen
  on the page), time.
- `GET /api/history` (newest first, can filter by task id).
- Simple history view: a "History" section on `/supervisor` or `/owner`
  (list: time, room, task, action, person). No separate login.

**Files (new / changed)**
- `src/lib/history.ts` (or inside `src/lib/store.ts`), events written from
  `src/app/api/tasks/[id]/route.ts` and the photo/AI-check routes
- History UI in `src/app/supervisor/` or `src/app/owner/`

### 10. Online

**Done**
- The app runs locally (`npm run dev` / `npm run start`). Nothing is online.

**Left (all MUST)**
- The app must be online over **HTTPS** (also needed so a phone browser
  allows the microphone and camera).
- **Hosting that fits:** a small VPS or a Node host with a persistent disk
  (for example Hetzner/DigitalOcean + Docker, or Render/Fly.io with a
  volume) **or** Vercel + a hosted Postgres (Neon/Supabase). Our app is a
  normal Next.js server app, so both fit.
  Recommendation for the hackathon: **Vercel + Neon/Supabase Postgres +
  Supabase Storage (or S3) for photos** — HTTPS is automatic, no server to
  patch, and data survives restarts. A VPS also works but we must set up
  HTTPS and backups ourselves.
- **What must change in storage:**
  - Tasks: replace the `.data/tasks.json` file with database tables
    (Postgres on Vercel/Neon, or SQLite on a VPS persistent disk). Keep the
    API routes and their shapes the same, so the pages do not change.
  - Photos: never save photos only on the server disk of a normal cloud
    host (they can be deleted on restart/redeploy). Save them in object
    storage (Supabase Storage / S3) or in the database; save only the URL
    on the task.
  - Keys: `MODEL_API_KEY` moves to the hosting provider's env settings.
    Still never in code, never in git.
- Deploy, then test the whole loop on the public HTTPS link (guest phone +
  staff phone/desktop).

**Files**
- `src/lib/store.ts`, `.env.example`, `README.md` (deploy steps)

## Task list

Small tasks, about 1–2 hours each. MUST = needed for one full working loop
by Nov 4. SHOULD = if time. LATER = only in this map, no Linear issues.
Linear issues exist for every MUST and SHOULD task; shared task titles have
no agent name. Linear numbers: M1=ANT-17, M2=ANT-18, M3=ANT-19, M4=ANT-20,
M5=ANT-21, M6=ANT-22, M7=ANT-23, M8=ANT-24, M9=ANT-25, M10=ANT-26,
M11=ANT-27, M12=ANT-28, S1=ANT-29, S2=ANT-30, S3=ANT-31, S4=ANT-32,
S5=ANT-33, S6=ANT-34. This map itself is ANT-16.

### MUST

| # | Task | Depends on | Done when |
|---|------|-----------|-----------|
| M1 | Choose hosting and write the deploy plan | — | Plan is in `docs/DEPLOY.md`: platform, HTTPS, env vars, where tasks/photos live. Anyone can follow it. |
| M2 | Move task storage to a real database | M1 | Tasks are in the DB (same API shapes). Restart the server: tasks are still there. `.data` file is not used. |
| M3 | Photo upload on staff tasks | M2 | Staff adds 1–3 photos to a started task on `/staff`; photos show on the task and are still there after a server restart. |
| M4 | Add "review" status end to end | M2 | Flow New -> Accepted -> In progress -> In review -> Done/Sent back works via API and `/staff`; guest still sees Received / On the way / Done correctly. |
| M5 | SAM 3.1 photo check API | M3 | `POST /api/tasks/[id]/ai-check` saves `{score, issues, model}` on the task (or a clearly marked MOCK when no key). curl test shows the saved result. |
| M6 | AI result + retake on staff board | M4, M5 | Staff sees the score and issues; "Retake photos" clears photos + AI result; staff can only send to review after a photo check ran. |
| M7 | Supervisor page: approve / send back | M4 | On `/supervisor`, a review task can be approved (-> Done) or sent back with a note (-> staff sees it and can fix). Guest status follows. |
| M8 | History events + history API | M2 | Every step writes an event (who, what, when). `GET /api/history` returns them newest first. |
| M9 | History view | M8 | A history list (time, room, task, action, person) is visible on `/supervisor` or `/owner` and matches the test loop. |
| M10 | Owner morning report (Muse Wonder) | M8 | `/owner` Generate button makes a short report from real task facts (MOCK marked if no key); report text shows counts that match the board. |
| M11 | Go online over HTTPS | M2, M3 | The app is on a public HTTPS link; guest + staff pages open on a phone; tasks and photos survive a restart/redeploy. |
| M12 | Full loop test online + demo script | M6, M7, M9, M10, M11 | The written demo script in README runs end to end on the public link: guest -> AI tasks -> staff -> photo -> AI check -> supervisor -> owner report -> history. |

Files per MUST task (short): M1 `docs/DEPLOY.md`, `.env.example` ·
M2 `src/lib/store.ts`, `src/app/api/tasks/*` · M3 photo route + `StaffBoard.tsx` ·
M4 `src/lib/tasks.ts`, `src/lib/store.ts`, `src/app/api/tasks/[id]/route.ts`,
`StaffBoard.tsx`, `GuestForm.tsx` · M5 ai-check route + `src/lib/tasks.ts` ·
M6 `StaffBoard.tsx` · M7 `src/app/supervisor/*`, tasks API · M8 `src/lib/history.ts`
(or store), tasks/photo/ai-check routes · M9 supervisor or owner page ·
M10 `src/app/owner/*`, `src/app/api/report/morning/route.ts` · M11 store,
hosting config, `README.md` · M12 `README.md` only (test + fixes in the files above).

### SHOULD

| # | Task | Depends on | Done when |
|---|------|-----------|-----------|
| S1 | Signed room QR link | M11 | `/r/204?t=<token>` works with a right token and shows a friendly error with a wrong one; old plain link still works for the demo. |
| S2 | Guest tracker steps | M4 | Guest confirmation shows steps Received -> On the way -> Done with the right step lit, like the v1.2 design. |
| S3 | Housekeeping checklist on staff tasks | M3 | A housekeeping task shows the v1.2 checklist; staff ticks items; ticks are saved and still there after refresh. |
| S4 | Assign a task to a named person | M2 | Staff board can set an assignee; "Only my tasks" filter shows only that person's tasks. |
| S5 | Flag low-confidence AI tasks | — | Tasks with confidence < 0.7 show a "Needs check" mark on `/staff`; other tasks do not. |
| S6 | Download the owner report | M10 | `/owner` has a Download button that saves the report as a `.md` file with today's date in the file name. |

Files per SHOULD task (short): S1 `src/app/r/[room]/page.tsx`, link helper ·
S2 `GuestForm.tsx` · S3 `StaffBoard.tsx`, task checklist field + API ·
S4 `StaffBoard.tsx`, `src/lib/tasks.ts`, tasks API · S5 `StaffBoard.tsx` ·
S6 `src/app/owner/page.tsx`.

### LATER (v1.2 screens, after the MVP loop)

No Linear issues for these. From the v1.2 design:

- Guest: food menu and ordering, items list, problem types, hotel info,
  AI guest chat (EN/RU/KK), language picker.
- Desktop app: sign-in/sign-up and roles, Overview (money charts), Today,
  Front desk (arrivals/departures), Rooms board, Bookings (with channel
  sync), Kitchen (live orders), Money (finance, invoices, exports),
  Settings (AI models per job, providers, integrations), Team and QR admin.
- Staff phone app: cleaner "my rooms" flow as a separate app, maintenance
  repairs list, check-in agent arrivals and door codes.
- Repairs as tickets, planned maintenance, supplies/inventory.
- Notifications (Telegram/WhatsApp), audit log page as designed in v1.2,
  morning report auto-send at 07:30, scheduled exports/backups.
- Real login and permissions (server-checked), password rules from
  `docs/API.md`. Country data rules must be checked by a lawyer (design
  note in the v1.2 `constants.ts`).

## How the two codebases fit together

- This repo (Next.js) is the working MVP: guest page, AI triage, voice,
  staff board. It stays the app we ship for the hackathon.
- The v1.2 folder is the **design and product reference** (screens, roles,
  API contract in `docs/API.md`). We copy ideas and screen structure from
  it; we do not rewrite the MVP in Vite/React from that folder.
- When a v1.2 screen becomes real work later, its API contract in
  `docs/API.md` is the starting point for the new route.
