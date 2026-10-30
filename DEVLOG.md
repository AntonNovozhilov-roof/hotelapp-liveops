# Dev Log

## Meta1 — 2026-10-31 — Plan change: build the full app locally first (ANT-5)

What I did (simple words): The owner changed the order. We now build the whole app on the Mac first — photos, review flow, AI photo check, supervisor, history, owner report (M3 to M10) — using the local `.data` files as today. The real database (M2) and going online (M11) come last and start on Nov 3 morning at the latest, then the full online test (M12).

Files changed:
- `docs/PROJECT_MAP.md` — new build order M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10 (all local), then M2 → M11 → M12; M2 removed from the dependencies of M3, M4 and M8 (they use the local `.data` storage for now); M3 photos live in local `.data/photos` behind one helper file; table reordered; M2/M11 rows marked "starts Nov 3 morning at the latest"
- `docs/DEPLOY.md` — work order rewritten (M3–M10 local first, then M2 → M11 → M12); photos row now says local `.data/photos` via `src/lib/photos.ts` and only that file changes in M11; Part A/Vercel steps moved to Nov 3; who-does-what table reordered
- `DEVLOG.md` — this entry

Linear:
- ANT-5 — comment with the new order
- ANT-19 (M3), ANT-20 (M4), ANT-24 (M8) — descriptions rewritten: no M2 dependency, local `.data` storage
- ANT-18 (M2), ANT-27 (M11) — descriptions rewritten: stay Todo, start Nov 3 morning at the latest; comments added on all five issues

How I checked it works:
- Docs-only change: no app code touched. Read both files back after editing; the order and dependencies match in the text, the task table, and the Linear descriptions.
- `git status` shows only `docs/PROJECT_MAP.md`, `docs/DEPLOY.md`, `DEVLOG.md` changed.

NOT working / NOT checked yet:
- Nothing new built yet — next step is ANT-19 (M3: photo upload on staff tasks), taken right after this commit.
- Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-5 (plan change); issues ANT-18, ANT-19, ANT-20, ANT-24, ANT-27 updated

## Meta1 — 2026-10-31 — Hosting choice + deploy plan, new build order (ANT-17 / M1)

What I did (simple words): Picked where the app will live online and wrote the exact steps. The app goes on Vercel (free, web address with HTTPS appears by itself). The saved tasks and, later, the staff photos go in Supabase — one service for both the database and photo storage (free). Both websites let the owner sign in with the GitHub login that already owns this repo, so there are as few accounts and passwords as possible, and no bank card. The plan in `docs/DEPLOY.md` has click-by-click steps for the only parts the owner must do by hand (create the Supabase project and save its database password in a password manager; later, at deploy time, import the repo in Vercel and paste the two secret values there — never into chat or Linear).

New build order (owner decision): M1 -> M2 -> M11 first (put what we already have — guest page and staff board — online right after the database move, so we can test on a real phone early), then M3-M10, then M12. M11 no longer waits for photos (M3): it now depends only on M1+M2, and photo survival online will be proved in M3 and again in M12. Added to M11's "Done when": the "Reset demo data" button must be hidden online (it stays on the Mac in local dev, so nobody can wipe the online data from a public page), and guest text + voice sending gets a simple per-minute limit per visitor (friendly "please wait" message, HTTP 429; suggested 10 texts and 5 voice recordings per minute).

Files changed:
- `docs/DEPLOY.md` — new: the choice and why (VPS and 3-service options rejected, in simple words), where tasks/photos/secrets live online vs on the Mac, the full env var list (names only), Part A owner clicks for Supabase (do now), Part B owner clicks for Vercel (at M11, after saying "push"), Part C phone checks after deploy, who-does-what table, and the warning that a free Supabase project pauses after about a week unused (one click to wake; check the link the day before any demo)
- `.env.example` — added `DATABASE_URL` (M2), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PHOTOS_BUCKET` (M3), all empty/with comments; rule written in the file: no `DATABASE_URL` locally = local `.data/tasks.json` as today, so local dev keeps working
- `docs/PROJECT_MAP.md` — Online block now names the chosen hosting; task table reordered M1, M2, M11, M3-M10, M12; M11 row depends on M1+M2 only and its "Done when" includes the hidden-online Reset button and the per-minute guest limit; M2 note that local dev without `DATABASE_URL` still uses `.data`
- `DEVLOG.md` — this entry

Linear:
- ANT-17 (M1) — taken by Meta1 ("Meta1: taking this"), In Progress, then Done with a summary comment
- ANT-27 (M11) — description rewritten: depends on ANT-17+ANT-18 only (M3 removed), "Done when" now includes hidden-online Reset button + simple per-minute limit on guest messages and voice, plus local-dev-still-works
- ANT-5 — comment with the new order M1 -> M2 -> M11 -> M3-M10 -> M12
- ANT-18 (M2) — comment: it is next, target is Supabase Postgres, local fallback must stay, owner runs the one SQL block it provides
- ANT-19 (M3) — comment: M11 now goes before it, so it must prove photos survive a redeploy online

How I checked it works:
- Read the current app first (store, guest message/voice routes, staff board): the app is a normal Next.js server app, tasks are a local `.data/tasks.json` file, the only secret today is `MODEL_API_KEY` — the plan is built on those facts.
- Checked today's free tiers on the official pricing pages (2026-10-31): Vercel Hobby $0 with automatic HTTPS; Supabase Free $0 with 500 MB database + 1 GB storage, pausing after 1 week of inactivity (written into the plan as a warning).
- This task changes docs and `.env.example` only, no app code: `npm run typecheck` ok, `npm run build` ok, fresh `npm run start` answered 200 on `/r/204` and `/staff`, and `/api/tasks` answered with the saved tasks — local dev behaviour is unchanged.
- Secret scan of the diff: no key/password values, only empty variable names in `.env.example`.

NOT working / NOT checked yet:
- Nothing is online yet, on purpose: deploying today's code would lose tasks on Vercel (local file storage). First real deploy is M11, after M2 moves tasks to Supabase.
- The owner still has to do Part A (create the Supabase project, save the database password in a password manager) and say "Supabase project created" in Linear. No accounts were created by the agent.
- The hidden-Reset and rate-limit items are written as M11 requirements; the code for them is part of ANT-27, not this task.
- Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-17, sub-issue of ANT-5

## Meta1 — 2026-10-31 — Project map (ANT-16)

What I did (simple words): No app code today. I read the full v1.2 design in the other folder (read only, changed nothing there), compared it with what we built here, and wrote the project map for the road to Nov 4.

Files changed:
- `docs/PROJECT_MAP.md` — new: what the app is (3 sentences), the full loop guest -> AI tasks -> staff -> photo proof -> AI photo check (SAM 3.1) -> supervisor approve/send back -> owner morning report (Muse Wonder) -> history, 10 blocks with done/left/files, a task list of 12 MUST + 6 SHOULD small tasks (about 1-2 hours each, with depends-on and "Done when"), LATER list (other v1.2 screens), and hosting: online over HTTPS with tasks/photos surviving restarts (recommendation: Vercel + hosted Postgres + object storage, or a VPS with a persistent disk; storage must move off the local .data file and off plain server disk for photos)
- `AGENTS.md` — new section "How agents take tasks", and the title rule fixed: [Meta1] is only for Meta1's own log issues, shared tasks have no agent prefix
- `DEVLOG.md` — this entry

Linear:
- ANT-16 "[Meta1] Project map" — sub-issue of ANT-5, marked Done
- 18 shared sub-issues of ANT-5 (no agent name, Todo): MUST = High priority ANT-17..ANT-28 (M1-M12), SHOULD = Medium priority ANT-29..ANT-34 (S1-S6). No Linear issues for LATER tasks.

How I checked it works:
- Read README.md, docs/API.md and the app/staff/guest screens in the v1.2 folder; `git status` in that folder is clean (nothing changed there).
- Checked the current repo file list and git log to write the "Done" parts from real files, not from memory.
- Opened one created Linear issue (ANT-22) and checked: title has no agent name, priority High, status Todo, parent ANT-5, description has what to build / files / depends on / Done when.

NOT working / NOT checked yet:
- The map is a plan. The photo proof, AI photo check, supervisor, owner report, history and online hosting are not built yet — they are the MUST tasks.
- Hosting choice (M1, ANT-17) is a recommendation in the map; the owner still has to pick/approve the platform and accounts.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-16, sub-issue of ANT-5

## Meta1 — 2026-10-29 — New-task badges on staff picker + plain Done label (ANT-13)

What I changed (simple words): On /staff, each person box in "Who are you?" now has a small round red badge in the corner with the number of NEW tasks for that person's team. The number updates by itself every 3 seconds, and there is no badge when the number is 0. In the Done column, "Done ✓" is now plain text, not a button-looking box.

Files changed:
- `src/app/staff/StaffBoard.tsx` — board now loads all tasks in one fetch, counts NEW tasks per team for the badges, red round badge in the corner of each person box (hidden at 0), Done column shows plain "Done ✓" text with no button styling and no button element
- `DEVLOG.md` — this entry

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok, app restarted.
- Made test tasks through the real guest API: Ruslan (Maintenance) badge showed 2, Aigerim (Housekeeping) showed 1, Daniyar and Madina showed no badge.
- Auto-update: with /staff open, sent "I need a taxi at 7 am" through the guest API — Daniyar's badge appeared with 1 without reloading the page.
- Done label: chose Aigerim on /staff — her Done column task shows plain "Done ✓" text and there is no button inside the Done column (checked in the page).
- Responsive: phone 355px in browser — badges visible, no sideways scroll. Desktop 1440px headless Chrome screenshot — red badges in the corners of Ruslan (2), Aigerim (1), Daniyar (1), none on Madina, 4 columns fine.

NOT working / NOT checked yet:
- Nothing new broken. Test tasks I created are still in the local .data file (staff can clear them with "Reset demo data").

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-13, sub-issue of ANT-5

## Meta1 — 2026-10-29 — Guest page privacy: only this message confirmation + staff reset (ANT-12)

What I changed (simple words): Guests no longer see the room's task history. After pressing Send, the guest sees a short confirmation only for the tasks made by that one message, with a simple live status. Refreshing the guest page starts clean. Staff still see everything, and staff can clear all demo tasks with a link at the bottom of /staff.

Status words for the guest: staff New and Accepted both show as "Received", staff In progress shows as "On the way", staff Done shows as "Done".

Files changed:
- `src/app/r/[room]/GuestForm.tsx` — removed the "Your tasks" history list; after Send it stores only this message's tasks (in this browser tab only, in memory) and polls only those task IDs every 3 seconds; confirmation lines like "Sent to Maintenance: Fix leak in the bathroom"
- `src/app/api/tasks/route.ts` — GET can now filter by task IDs, and new DELETE clears all tasks
- `src/lib/store.ts` — IDs filter + clear-all function
- `src/app/staff/StaffBoard.tsx` — small "Reset demo data" link at the bottom; asks "Are you sure? This will delete ALL saved tasks for every room and team." before deleting
- `README.md` — privacy behaviour and reset explained

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok, app restarted.
- Privacy: the server had 15 saved room-204 tasks, but a fresh /r/204 page showed none of them (checked no "Your tasks", no old task titles in the page).
- Sent "The air conditioner is broken" on /r/204: confirmation showed exactly 1 line "Sent to Maintenance: Fix air conditioner in room 204" with "Received".
- On /staff as Ruslan pressed Accept then Start: the guest page (no reload) changed to "On the way". Pressed Done on staff: guest page changed to "Done".
- Refreshed the guest page: no confirmation, no history — clean start.
- Reset: clicked "Reset demo data" on /staff, the "Are you sure?" dialog appeared, accepted it: API returned 0 tasks, .data/tasks.json is [], and the staff board shows 0 in all 4 columns.
- Responsive: phone 355px in browser — guest and staff with no sideways scroll. Desktop 1440px headless Chrome screenshots — staff columns and the reset link at the bottom look fine.

NOT working / NOT checked yet:
- The reset in my test deleted all the old local test tasks (that is what it is for). The demo now starts with an empty task list — send a new guest message to see tasks again.
- Guest confirmations are per-tab in memory, by design: closing or refreshing the tab clears them.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-12, sub-issue of ANT-5

## Meta1 — 2026-10-29 — Voice transcript into text box, Send to create tasks (ANT-11)

What I changed (simple words): After recording, the voice text now goes into the text box and waits. The guest reads it, can fix wrong words, and presses Send. Only then are tasks created — the same as typed text. Language is still detected automatically (no picker).

Files changed:
- `src/app/r/[room]/GuestForm.tsx` — transcript now only fills the text box (no automatic send), hint "Check the text and fix it if needed, then press Send." appears above the text box until Send, hint disappears after Send
- `README.md` — voice steps updated

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok, app restarted.
- Browser test on /r/204 with the fake microphone (spoken test file played into the recorder, same as ANT-10): after Stop, the text box contained "There is a leak in the bathroom. Please bring towels.", the hint was shown, "Language: English" was shown, and the task count stayed at 12 — no tasks were created automatically (also checked the server task count stayed 12).
- Then I edited the text in the box (changed it to "...bring extra towels.") and pressed Send: tasks went from 12 to 14, the hint disappeared, the text box cleared, no browser errors.
- Responsive: phone 355px in browser — no sideways scroll. Desktop 1440px headless Chrome screenshot — page fine.

NOT working / NOT checked yet:
- A real person re-testing the new flow by voice is not checked by me (I used the fake-microphone file test again; the user already proved real voice works in English and Russian for ANT-10).
- Old test tasks keep growing in the local .data file during tests.

AI model that helped: Muse via opencode (Meta1). Speech model in the test: muse-voice-transcribe-1.0
Linear: ANT-11, sub-issue of ANT-5

## Meta1 — 2026-10-29 — Voice input on guest page /r/204 (ANT-10)

Docs checked first (as asked): Meta official docs https://dev.meta.ai/docs/speech-to-text and https://dev.meta.ai/docs/api-reference/voice/transcribe + schemas page. Exact format: POST https://api.meta.ai/v1/asr/transcribe, multipart/form-data with "request" (JSON: model muse-voice-transcribe-1.0, audioEncoding WAV, mode PUSH_TO_TALK) and "audio" (WAV file). Audio must be RIFF/WAVE mono 16-bit PCM at 16 or 24 kHz. Response: {sessionId, transcript, audioDurationMs, turns}. Important: the official response schema has NO detected-language field, so the app reads a language field if Meta ever sends one, and otherwise guesses the language from the transcript text (marked as a guess in the API response with languageSource).

What I built (simple words): On /r/204 there is now a Mic button next to Send. Press Mic, speak, press Stop (auto-stop at 45 seconds, the page shows "Recording… 0:05 / 0:45"). The browser recording is converted in the browser to WAV 24 kHz (Meta accepts only WAV, Chrome records WebM), sent to the new server route, transcribed by Meta, shown as "We heard: ..." with the language, and then sent through the same task routing as typed text. If the microphone is blocked or transcription fails, a friendly message says to type instead.

Files changed:
- `src/app/r/[room]/GuestForm.tsx` — Mic/Stop button, recording timer (max 45s), browser WAV conversion, "We heard" + language display, sends transcript through the existing routing
- `src/app/api/guest/transcribe/route.ts` — new route; checks WAV header, calls POST /v1/asr/transcribe with the key from .env.local (never printed), friendly errors
- `src/lib/language.ts` — language from Meta if present, else a small guess from the transcript (script + common words)
- `README.md` — how to try voice, plus the phone/HTTPS note

How I checked it works:
- Direct Meta API test with a spoken test file (macOS "say", Samantha voice, converted to WAV 24 kHz mono): HTTP 200, transcript "There is a leak in the bathroom. Please bring towels."
- Our route with the same file: HTTP 200, transcript + language English. A non-WAV file returned 415 with a friendly message.
- `npm run typecheck` ok, `npm run build` ok (new route /api/guest/transcribe).
- Full browser test on /r/204 with a fake microphone (a test page trick: the spoken test file was played into the browser recorder because I cannot speak into the computer mic): pressed Mic, saw "Recording… 0:13 / 0:45", pressed Stop, page showed "We heard: There is a leak in the bathroom. Please bring towels.." and "Language: English", tasks grew from 3 to 5 (new leak + towels tasks, LIVE), transcribe and message APIs both 200, no app console errors.
- Blocked microphone test (permission denied on purpose): friendly message "The microphone is blocked. Please allow microphone access in your browser, or type your request instead." appeared.
- Responsive: phone 355px in browser — no sideways scroll (Mic and Send fit in one row). Desktop 1440px headless Chrome screenshot — Mic next to Send, page fine.

NOT working / NOT checked yet:
- I cannot speak into a real microphone in this session, so a real human-voice recording by a person is NOT checked. The user should test: open /r/204 in Chrome, press Mic, allow microphone, say "There is a leak in the bathroom. Please bring towels.", press Stop, check "We heard: ..." and new tasks.
- Real phone test is NOT checked: Chrome on a phone blocks the microphone on plain http network addresses (needs HTTPS or localhost). Typing works. Setting up an HTTPS tunnel is a separate step if wanted.
- Language is a guess from the text when Meta returns no language field (today it does not, per the official schema).
- Test tasks from this test are still in the local .data file.

AI model that helped: Muse via opencode (Meta1). Speech model tested: muse-voice-transcribe-1.0
Linear: ANT-10, sub-issue of ANT-5

## Meta1 — 2026-10-29 — Staff screen /staff with saved tasks (ANT-9)

What I built (simple words): Tasks from the guest page are now saved. Staff open /staff, choose their name, see only their team tasks, and move each task with Accept -> Start -> Done. The guest page shows the live status of its tasks and refreshes itself every 3 seconds.

Files changed:
- `src/lib/tasks.ts` — saved-task type, statuses (new/accepted/in_progress/done), staff list (Ruslan, Aigerim, Daniyar, Madina), sorting (most urgent, then newest), "time ago" helper
- `src/lib/store.ts` — saves tasks to `.data/tasks.json` (creates folder, atomic write, blocks skipping statuses)
- `src/app/api/guest/message/route.ts` — now saves every created task (LIVE and MOCK) and returns the saved tasks
- `src/app/api/tasks/route.ts` — GET tasks, can filter by room or department
- `src/app/api/tasks/[id]/route.ts` — PATCH task status; only New -> Accepted -> In progress -> Done is allowed
- `src/app/staff/page.tsx`, `src/app/staff/StaffBoard.tsx` — staff screen: pick who you are, only your team tasks, room/title/priority/time ago, Accept/Start/Done buttons, refreshes every 3 seconds
- `src/app/r/[room]/GuestForm.tsx` — guest page loads the room tasks, polls every 3 seconds, shows status chips (New / Accepted / In progress / Done)
- `src/app/r/[room]/page.tsx`, `src/app/page.tsx` — wider container on desktop, staff link on home page
- `.gitignore` — added `.data/`
- `README.md` — staff screen and try-it steps

How I checked it works:
- `npm run typecheck` — ok. `npm run build` — ok (routes /, /staff, /r/[room], /api/guest/message, /api/tasks, /api/tasks/[id])
- API: GET /api/tasks was empty at start; PATCH with a wrong id returned 404; trying to jump a Done task back to Accepted returned 409
- Full test in the browser: on /r/204 sent "leak in the bathroom and bring towels" (LIVE AI), got 2 saved tasks. On /staff as Ruslan (Maintenance) the leak task was in New; pressed Accept (moved to Accepted), Start (moved to In progress), Done (moved to Done). The guest page, without reload, first showed "In progress", then "Done". File `.data/tasks.json` contains both tasks with the right statuses, and it is ignored by git.
- Team filter: on /staff chose Aigerim (Housekeeping): only "Bring towels" was shown, the leak task was not shown. "1 min ago" text was visible.
- Responsive: phone 355px in the browser — status sections stacked in one column (same x and width), staff buttons in one column, no sideways scroll. Desktop 1440px headless Chrome screenshot of /staff — 4 columns side by side (New / Accepted / In progress / Done) and 4 staff buttons in a row; guest page screenshot at 1440px also fine. Note: one iframe-based desktop test failed inside an about:blank frame, so the desktop check was done with headless Chrome screenshots instead.

NOT working / NOT checked yet:
- Saved tasks are a simple JSON file for now (no database, no login). Anyone can open /staff and pick any name.
- Old test tasks stay in `.data/tasks.json` until the file is deleted by hand. It is local only and not in git.
- Sorting is most urgent first, then newest first.

AI model that helped: Muse via opencode (Meta1). AI in the test: muse-spark-1.3 (LIVE)
Linear: ANT-9, sub-issue of ANT-5

## Meta1 — 2026-10-29 — Responsive rule in AGENTS.md (ANT-8)

What I changed (simple words): Added one rule to AGENTS.md under "Other rules": every page must work well on phone (from 375px wide) and desktop (up to 1440px), use a responsive layout (one column on phones, wider on desktop), and test every new page at both sizes before saying it is done.

Files changed:
- `AGENTS.md` — new rule under "Other rules"
- `DEVLOG.md` — this entry

How I checked it works:
- Read AGENTS.md after the edit: the new rule is under "Other rules".
- This rule is for future pages; no page code changed in this step, so no page test was done here.
- Secret scan before commit: no keys. `.env.local` not staged (git-ignored).
- Committed locally, not pushed.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-8, sub-issue of ANT-5

## Meta1 — 2026-10-29 — Test real Meta AI on /r/204 (ANT-7)

What I did (simple words): The user added a key to .env.local (key never printed). I restarted the app and tested the guest page with the real Meta AI, not MOCK.

Files changed:
- `DEVLOG.md` — this entry only. No code changes. `.env.local` is ignored by git and was not read or printed.

How I checked it works:
- Checked only that MODEL_API_KEY is present (non-empty) in .env.local. The value was never printed.
- Restarted the app on http://localhost:3000 (production server).
- `curl POST /api/guest/message` with "leak in the bathroom and bring towels", room 204, returned HTTP 200: mode LIVE, model muse-spark-1.3, task 1 maintenance / "Fix leak in the bathroom" / high / 0.95, task 2 housekeeping / "Bring towels" / low / 0.95
- Browser: opened http://localhost:3000/r/204, typed the same text, pressed Send, saw "Tasks created (2)" with the LIVE AI badge (no MOCK), first task "Fix leak in the bathroom — Maintenance — Room 204 — Confidence: 95%". No browser console errors. Screenshot taken. The API request took about 4.5 seconds in the browser.

NOT working / NOT checked yet:
- Only this one test message was checked with the real AI. Other message types were not re-tested live.
- Note: the real model gave the towels task priority "low" (the MOCK gave "medium"). Both are valid values, but priority tuning is a later step.
- Tasks are not saved anywhere yet, and there is no staff page yet.
- This DEVLOG entry was committed locally on 2026-10-29 (no .env.local, no keys in the commit). Not pushed to GitHub in that step.

AI model that helped: Muse via opencode (Meta1). AI model tested in the app: muse-spark-1.3 (Meta Model API)
Linear: ANT-7, sub-issue of ANT-5

## Meta1 — 2026-10-29 — Guest page /r/204 and AI routing API (ANT-6)

What I built (simple words): A guest in room 204 can open a web page, write a request, and press Send. The server turns the text into tasks for the right hotel team and shows the tasks under the text box. One message can make 2 tasks.

Files changed:
- `package.json`, `package-lock.json` — Next.js 15 + TypeScript + Tailwind project
- `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `next-env.d.ts` — project config
- `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` — app shell and home page
- `src/app/r/[room]/page.tsx`, `src/app/r/[room]/GuestForm.tsx` — guest page, works at /r/204
- `src/app/api/guest/message/route.ts` — POST API; calls Meta Model API (https://api.meta.ai/v1, model muse-spark-1.3, key only from MODEL_API_KEY in .env.local) and validates the returned JSON
- `src/lib/tasks.ts` — task types, validation, and the fake MOCK routing
- `.env.example` — example env file, empty key. No key in code.
- `README.md` — how to run it
- `.gitignore` — already existed and already covered node_modules, .next, and .env.* (except .env.example); checked, no change needed

How I checked it works:
- `npm install` — ok
- `npm run typecheck` — ok, no errors
- `npm run build` — ok (Next.js 15.5.28); routes /, /r/[room], /api/guest/message built
- Started the app, opened http://localhost:3000/r/204 in the browser: typed "leak in the bathroom and bring towels", pressed Send, saw "Tasks created (2)" with the MOCK badge and "Fix water leak — Maintenance — high — 92%". No browser console errors. Screenshot taken.
- `curl POST /api/guest/message` with the same text returned: mode MOCK, task 1 maintenance / "Fix water leak" / high / 0.92, task 2 housekeeping / "Bring towels" / medium / 0.94
- Empty message returned HTTP 400 with a clear error
- Checked no API key is in the code; the key is only read with process.env.MODEL_API_KEY

NOT working / NOT checked yet:
- The real Meta AI call is NOT checked, because there is no MODEL_API_KEY yet. With no key, the app uses the fake MOCK answer and shows MOCK. Add a key to .env.local and restart to test the real AI.
- Tasks are not saved anywhere yet, and there is no staff page yet. That is for a later step.
- Not pushed to GitHub.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-6, sub-issue of ANT-5
