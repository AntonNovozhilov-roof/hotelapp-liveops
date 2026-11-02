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
Product change, 2026-10-31 (owner, T1 / ANT-39, before M6): not every task
needs a photo. The AI picks a task type as well as the department —
request (no photo, no review), cleaning (photo + AI check, then review),
repair (proof photo, no AI check, straight to Done; supervisor can reopen).
The type rules live in one place (`src/lib/task-types.ts`).

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

**Plan change, 2026-10-31 (owner): build the full app locally first;
database and going online come last.** Everything in the loop is built and
checked on the Mac against the local `.data` storage, in the order
M3 → M4 → M5 → D1 → D2 → M6 → M7 → M8 → M9 → M10. Only then M2 (real database) →
M11 (online over HTTPS) → M12 (full loop test online). M2 and M11 start
on **Nov 3 morning at the latest**. In the end, everything in the loop must
work online over HTTPS, and saved tasks and photos must survive a server
restart.

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
  to a real database, keep the same API shape — but this is **M2, done last**
  (plan change 2026-10-31, start Nov 3 morning at the latest). Until then,
  M3–M10 use the local `.data` storage as today.
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
  sees only their team tasks, urgent first then oldest first
  (first in, first out; same rule in every column, shown under the
  column title as "Urgent first, then oldest").
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
- Photos are saved locally in `.data/photos` (git-ignored, never committed)
  so they survive restarts, and the photo URLs live on the task. All photo
  saving and reading lives in one small helper file (`src/lib/photos.ts`),
  so it can later switch to cloud storage by changing only that file.
  (Plan change 2026-10-31: M3 no longer waits for the database, M2.)
- Staff can retake (delete photos and the AI result, like v1.2 `retake`;
  the button itself is built in M6, with the AI result).

**Files (new)**
- `src/lib/photos.ts` — the one photo helper (save / read / delete files in
  `.data/photos`); the only file to change when photos move to the cloud
- `src/app/api/tasks/[id]/photos/route.ts` (upload + delete),
  `src/app/api/photos/[name]/route.ts` (serve one photo),
  photo list on the task in `src/lib/tasks.ts` / `src/lib/store.ts`
- Photo UI in `src/app/staff/StaffBoard.tsx` (or a per-task panel there)

**P1 update (2026-10-31, ANT-45):** Rooms & QR holds per-room "Perfect room
photos" (1–3, labels Bed area/Bathroom/Other; owner or supervisor). On upload,
Muse Spark lists the objects in the perfect photo (Meta image-understanding
docs) and SAM 3.1 finds/counts them (fallback: `BROAD_ROOM_ITEMS` in
`src/lib/photo-check.ts`); the result is cached on the reference until a
person presses "Set as perfect reference". Replacing archives the old
reference (who/when/reason kept). Cleaning checks compare all cleaner photos
with the active reference; screens show only a simple verdict (item names,
counts and confidence stay system-only). 1st fail = retake only, 2nd fail =
auto review flagged "Failed AI check twice", sure pass + the owner
auto-approve setting (off by default) = Done (supervisor can reopen).

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
- Page `/supervisor` (M7 / ANT-23): review queue of cleaning tasks in
  **review**, each with room, title, who cleaned, photo(s) (tap to
  enlarge), AI score and the one-line AI result. Order: AI "not found"
  or "not sure" first, then oldest first. **Approve** (task -> done;
  guest sees Done) and **Send back** (task -> in_progress, short note
  staff can see) — server-checked for supervisor **or Owner** (the
  Owner can open and use the page too). The "New cleaning task" form
  and "Finished repairs" with Reopen stay on the page. Sign-in (D2)
  replaced the old person-picker idea.

**Left**
- Nothing for the MVP loop here. (History view M9 may add a section.)

**Files (new)**
- `src/app/supervisor/page.tsx`, `src/app/supervisor/SupervisorBoard.tsx`
- Status changes reuse `PATCH /api/tasks/[id]`

### 8. Owner report

**Done (M10+S6, 2026-10-31, ANT-26/ANT-34)**
- Reports page `/reports` (owner + supervisor; staff refused by page and API)
  with Daily (yesterday + today so far, auto-made on first open after 07:00,
  Regenerate button) and Weekly (last 7 days) tabs, plus an old-reports list.
- Facts are calculated first in `src/lib/reports.ts` (per team, done/open,
  urgent, waiting >2h, accept/finish averages, cleaning AI pass/fail/twice,
  sent back, reopened repairs, rooms without a perfect photo, repeat problem
  in the same room, workload per person, unanswered guest questions). Muse
  Wonder (`muse-wonder-1.0`, `POST /v1/chat/completions` — official Meta
  docs at dev.meta.ai/docs/models) only restates those facts; every number
  in its text is checked against them (one retry, then a plain facts report).
  "All numbers checked ✓" shows on a pass. No key / model error = clearly
  marked MOCK report from the same facts. Points expand to their tasks.
- Download as PDF and .md, Copy text (S6). Owner-only "Load sample week
  (demo)" creates 22 clearly labelled sample tasks+history over 7 days
  (incl. 3 leaks in room 204); "Remove sample data" deletes only those.
  Reports made with sample data show "Includes sample data".

**Left**
- Sending the report to Telegram/WhatsApp is LATER.

**Files**
- `src/app/reports/*`, `src/app/api/reports/*`, `src/lib/reports.ts`,
  `src/lib/reports-store.ts`, `src/lib/sample-week.ts`

### 9. History

**Done (M8+M9, 2026-10-31, ANT-24/ANT-25)**
- Every step saves an event in `.data/history.json` (`src/lib/history.ts`):
  task created (Guest via AI, or supervisor/owner), accepted, started,
  photo added/removed, AI check (verdict; score/model/item details stored
  system-only), sent to review (incl. the automatic 2nd-fail one),
  approved (by whom, or auto-approved by AI), sent back (note), reopened,
  done — plus reference photo added/approved/replaced, QR regenerated,
  rooms changed and hotel info saved. Each event: time, who (name + role,
  or Guest / AI), room, task, action, short details. The guest chat is
  never stored, only the request text.
- `GET /api/history` (owner/supervisor only): newest first; filters room,
  person, task type, today / last 7 days, search, and `?task=<id>`.
- History page `/history` (owner + supervisor; staff are sent away and
  the API refuses them): filters + search, and a per-task timeline
  (oldest first) linked as "Timeline" from review cards and history rows.

**Files (new / changed)**
- `src/lib/history.ts` (or inside `src/lib/store.ts`), events written from
  `src/app/api/tasks/[id]/route.ts` and the photo/AI-check routes
- History UI in `src/app/supervisor/` or `src/app/owner/`

### 10. Online

**Done**
- The app runs locally (`npm run dev` / `npm run start`). Nothing is online.
  This is on purpose until the end (plan change 2026-10-31): the full app is
  built locally first (M3–M10), then M2 → M11 → M12. **M2 and M11 stay Todo
  and start on Nov 3 morning at the latest.**

**Left (all MUST, last — after M3–M10)**
- The app must be online over **HTTPS** (also needed so a phone browser
  allows the microphone and camera).
- **Hosting (chosen in M1, 2026-10-31 — see `docs/DEPLOY.md`):**
  **Vercel (Hobby, free)** runs the app with automatic HTTPS, and
  **Supabase (Free)** is the one service for both Postgres (tasks/history)
  and Storage (photos, bucket `task-photos`). Both sign in with the
  owner's existing GitHub account, so there are the fewest accounts and
  steps for a non-developer owner. A VPS was rejected: more manual
  HTTPS/backup/patching work. Full click-by-click owner steps, env vars,
  and local-dev fallback rules are in `docs/DEPLOY.md`.
- **What must change in storage:**
  - Tasks: replace the `.data/tasks.json` file with database tables
    (Postgres on Vercel/Neon, or SQLite on a VPS persistent disk). Keep the
    API routes and their shapes the same, so the pages do not change.
  - Photos: until then they live in local `.data/photos`, behind the one
    helper file `src/lib/photos.ts`. Online, never save photos only on the
    server disk of a normal cloud host (they can be deleted on
    restart/redeploy): switch only that helper file to object storage
    (Supabase Storage / S3) or the database; only the URL lives on the task.
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
M5=ANT-21, D1=ANT-37, D2=ANT-38, T1=ANT-39, M6=ANT-22, M7=ANT-23, M8=ANT-24,
M9=ANT-25, M10=ANT-26, M11=ANT-27, M12=ANT-28, S1=ANT-29, S2=ANT-30,
S3=ANT-31, S4=ANT-32, S5=ANT-33, S6=ANT-34. This map itself is ANT-16.

**Build order (changed again 2026-10-31, owner: build the full app locally
first; database and going online come last): M3 → M4 → M5 → M6 → M7 → M8 →
M9 → M10 (all local), then M2 → M11 → M12.** The table below is in that
order. **M2 was removed from the dependencies of M3, M4 and M8** — they use
the local `.data` storage for now (photos in `.data/photos`, behind one
helper file). **M2 and M11 stay Todo and start on Nov 3 morning at the
latest.** (M1 is already Done.)

**Plan change, 2026-10-31 (owner): v1.2 look + demo sign-in before M6.**
The new order is **M5 → D1 → D2 → T1 → M6 → M7 → M8 → M9 → M10** (then M2 →
M11 → M12 as before). D1 ports the design basics of our earlier v1.2
prototype (`/Users/batyr/Documents/hotelapp/hotelapp-v1.2`, read only:
colors, fonts, button/card/badge/page-shell) into this Next.js app and
restyles the guest and staff screens — same features, nothing removed.
D2 adds a demo sign-in (accounts + simple demo password shown on the
login page; real sign-up comes with the database in M2) and one screen
per role; the server checks roles (only a supervisor approves / sends
back; Reset demo data is Owner-only; the guest page stays open).

### MUST

| # | Task | Depends on | Done when |
|---|------|-----------|-----------|
| M3 | Photo upload on staff tasks | — | Staff adds 1–3 photos to a started task on `/staff`; photos show on the task and are still there after a server restart. Photos are saved locally in `.data/photos` (git-ignored) and all photo saving/reading lives in one small helper file, so it can later switch to cloud storage by changing only that file. |
| M4 | Add "review" status end to end | — | Flow New -> Accepted -> In progress -> In review -> Done/Sent back works via API and `/staff`; guest still sees Received / On the way / Done correctly. Uses the local `.data` storage (no database yet). |
| M5 | SAM 3.1 photo check API | M3 | `POST /api/tasks/[id]/ai-check` saves `{score, issues, model}` on the task (or a clearly marked MOCK when no key). curl test shows the saved result. |
| D1 | v1.2 look for guest and staff screens | M5 | Guest page and staff screens use the ported v1.2 design (colors, fonts, shared button/card/badge/page shell); same features (voice, photos, AI check, review), English only, checked at 375px and 1440px. |
| D2 | Demo sign-in and role screens | D1 | `/login` with the demo accounts lands each person on their own v1.2-style screen (staff see only their department); the server refuses approve/send-back without a supervisor and Reset without the Owner; guest page stays open; sign out works. |
| T1 | Task types and photo rules | — | AI also picks a task type: request (Accept → Start → Done, no photo/review), cleaning (photo + AI check → review), repair (proof photo, no AI check → Done; supervisor can reopen). Type rules in one place; type shown on each task card; supervisor/owner can create "Clean room <number>"; old tasks guess type from title, else request; short one-line AI check text. |
| M6 | AI result + retake on staff board (cleaning tasks only) | M4, M5, T1 | Cleaning tasks only: staff sees the score and issues; "Retake photos" clears photos + AI result; a cleaning task can only be sent to review after a photo check ran. Request and repair tasks do not use this. |
| M7 | Supervisor page: approve / send back | M4 | On `/supervisor`, a review task can be approved (-> Done) or sent back with a note (-> staff sees it and can fix). Guest status follows. |
| R1 | Rooms and QR codes (owner) (ANT-41) | — | Owner adds rooms by floor/range + single add/remove/fix; random QR token per room (`/r/<room>?t=<token>`), wrong token friendly page, demo-mode setting on by default; QR grid (filter/search, Download PNG, Copy link, full screen, Regenerate with confirm), Print all A4 page. Supervisor view/print only, staff blocked. S1 merged into R1. |
| G2 | Hotel info sheet (owner) (ANT-42) | R1 | Hotel name/address/phones/Wi-Fi/times/breakfast/rules + extra Q&A add/edit/delete, saved with "Saved" message; guest header shows hotel name. Owner only. |
| G1 | Guest AI assistant (ANT-43) | G2 | Guest chat (bubbles, voice as now); one muse-spark-1.3 call returns reply + tasks JSON with last 6 messages; reply rules (guest language, team confirm, no times, info only from sheet, unknown → front desk task, emergency → call numbers + urgent task, no invented prices); live status lines; tab-only chat; MOCK replies marked. |
| F1 | Small fixes from owner testing (ANT-44) | — | "Print all" opens a popup (no new page): PDF for printing (A4, several QR cards per page) or all PNGs in one ZIP (file name = room number), all rooms or one floor, direct download. Done column on every board is newest first; other columns stay urgent first, then oldest. |
| P1 | Perfect room reference photos (ANT-45) | — | Each room has 1–3 "perfect room" photos (Bed area / Bathroom / Other). Muse Spark lists the objects in the perfect photo (Meta image-understanding docs), SAM 3.1 finds/counts them (broad fallback list in one place); the check runs on upload and a person presses "Set as perfect reference" (cached). Replacing archives the old reference (who/when/reason history). Cleaning checks compare all cleaner photos with the active reference and show only a simple verdict — item names/counts stay system-only. 1st fail = retake only, 2nd fail = auto review flagged; pass = one-tap approve; owner auto-approve setting (off by default); no reference = simple check + hint. |
| M8 | History events + history API | — | Every step writes an event (who, what, when). `GET /api/history` returns them newest first. Uses the local `.data` storage (no database yet). |
| M9 | History view | M8 | A history list (time, room, task, action, person) is visible on `/supervisor` or `/owner` and matches the test loop. Delivered as the `/history` page (owner + supervisor), linked from both homes and from review cards ("Timeline"). |
| M10 | Owner morning report (Muse Wonder) | M8 | Done (ANT-26): `/reports` Daily/Weekly tabs; facts first, numbers checked, tap a point for its tasks, sample week, MOCK marked if no key. |
| U1 | v1.2 polish pass on every screen (ANT-46) | — | Done: same role nav + PageHeader everywhere, Today-at-a-glance on owner/supervisor homes, 44px phone tap targets, helpful empty/loading/error states, "5 min ago" times; checked at 375/768/1440 for every role. No new features. |
| M1 | Choose hosting and write the deploy plan (Done) | — | Plan is in `docs/DEPLOY.md`: platform, HTTPS, env vars, where tasks/photos live. Anyone can follow it. |
| SEC1 | Security fixes before going online (ANT-57) | — (before M2) | Auth on tasks/photos/history/reports APIs (staff = own department only, guests only own task statuses via signed guest cookie, no guest photos); signed 12h session cookies (`SESSION_SECRET`); `DEMO_MODE`/`ALLOW_DEMO_RESET` demo safety; guest-safe hotel info only with a valid room link; guest rate limits (10 text / 5 voice per min) + daily AI cap (`AI_DAILY_LIMIT`, marked MOCK when reached); foreign-Origin rejection on mutating requests; `npm test` proves it all. |
| B1 | Brand: app is now called Readybell (ANT-58) | — | Done: Readybell name + logo (copied to `public/brand/`) in tab titles/favicon/apple-touch-icon, login stacked logo, top bar (full desktop / bell mark phone), MOCK banner, QR print sheet + branded QR PNGs (small logo + hotel name), report PDF header, README title. Guest page keeps hotel name as main title with small “Powered by Readybell” footer. Colors unchanged. |
| E1 | Team: owner/supervisor add employees (ANT-59) | — | Done: Team page (`/team`, owner+supervisor); owner manages everyone, supervisor only staff roles. Add name/role/login (unique validated), generated readable password shown once with Copy + printable login card. Reset password (once), edit, deactivate (signs out, history kept)/reactivate, no delete. Profile menu: change own password. scrypt hashes (`src/lib/employees.ts`, `.data/employees.json`), login limit 5 fails/min/login, demo accounts only in DEMO_MODE. Cards show Accepted by <name>; history uses real person. |
| M2 | Move ALL saved data to a real database (scope widened by SEC1, 2026-11-02) | M1, SEC1 | **Not only tasks:** tasks, history, reports, rooms and QR tokens, hotel info, settings, perfect room references, photos (to Supabase Storage), employees (E1: logins + scrypt password hashes, active flag, last sign-in — `src/lib/employees.ts`), and bookings + room types/prices/notes + currency (R2: `src/lib/bookings.ts`, room fields in `src/lib/hotel-data.ts`) all live in the database/storage (same API shapes). Restart the server: everything is still there. `.data` files are not used when `DATABASE_URL` is set, and local dev without `DATABASE_URL` still uses `.data` exactly as before. |
| M11 | Go online over HTTPS — starts Nov 3 morning at the latest (after M2) | M1, M2 | The full app (guest, staff, supervisor, owner, as built in M3–M10) is on a public HTTPS link; pages open on a phone; tasks and photos survive a restart/redeploy (photo storage switches from `.data/photos` to cloud at this point, by changing only the photo helper file). "Reset demo data" shows only when `ALLOW_DEMO_RESET=true` (SEC1; default off everywhere). Guest text (10/min) + voice (5/min) sending is rate-limited per IP and per room (friendly "Please wait a moment" / HTTP 429, SEC1). |
| M12 | Full loop test online + demo script | M6, M7, M9, M10, M11 | The written demo script in README runs end to end on the public link: guest -> AI tasks -> staff -> photo -> AI check -> supervisor -> owner report -> history. |

Files per MUST task (short): M1 `docs/DEPLOY.md`, `.env.example` ·
M2 `src/lib/store.ts`, `src/app/api/tasks/*` · M3 `src/lib/photos.ts` + photo routes + `StaffBoard.tsx` ·
M4 `src/lib/tasks.ts`, `src/lib/store.ts`, `src/app/api/tasks/[id]/route.ts`,
`StaffBoard.tsx`, `GuestForm.tsx` · M5 ai-check route + `src/lib/tasks.ts` ·
D1 `src/components/ui.tsx`, `globals.css`, guest + staff screens ·
D2 `src/lib/auth.ts`, `src/app/login/*`, `src/app/api/auth/*`, role screens,
tasks/photo/ai-check APIs (server role checks) ·
T1 `src/lib/task-types.ts` (the one type-rules place), `src/lib/tasks.ts`,
`src/lib/store.ts`, guest message + tasks APIs, `StaffBoard.tsx`,
supervisor/owner homes · M6 `StaffBoard.tsx` (cleaning tasks only) ·
M7 `src/app/supervisor/*`, tasks API · M8 `src/lib/history.ts`
(or store), tasks/photo/ai-check routes · M9 supervisor or owner page ·
M10 `src/app/owner/*`, `src/app/api/report/morning/route.ts` · M11 store,
hosting config, `README.md` · M12 `README.md` only (test + fixes in the files above).

### SHOULD

| # | Task | Depends on | Done when |
|---|------|-----------|-----------|
| S1 | Signed room QR link | — | **Merged into R1 (ANT-41)** on 2026-10-31 — delivered there, not a separate task. |
| S2 | Guest tracker steps | M4 | Guest confirmation shows steps Received -> On the way -> Done with the right step lit, like the v1.2 design. |
| S3 | Housekeeping checklist on staff tasks | M3 | A housekeeping task shows the v1.2 checklist; staff ticks items; ticks are saved and still there after refresh. |
| S4 | Assign a task to a named person | M2 | Staff board can set an assignee; "Only my tasks" filter shows only that person's tasks. |
| S5 | Flag low-confidence AI tasks | — | Tasks with confidence < 0.7 show a "Needs check" mark on `/staff`; other tasks do not. |
| S6 | Download the owner report | M10 | Done (ANT-34): `/reports` Download PDF + Download .md (date in the file name) + Copy text. |

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
- Manual bookings per room (owner enters dates), manual income and
  expenses. No booking-site integrations.

## How the two codebases fit together

- This repo (Next.js) is the working MVP: guest page, AI triage, voice,
  staff board. It stays the app we ship for the hackathon.
- The v1.2 folder is the **design and product reference** (screens, roles,
  API contract in `docs/API.md`). We copy ideas and screen structure from
  it; we do not rewrite the MVP in Vite/React from that folder.
- When a v1.2 screen becomes real work later, its API contract in
  `docs/API.md` is the starting point for the new route.
