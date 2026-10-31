# Dev Log

## Meta1 — 2026-10-31 — v1.2 look for guest and staff screens (ANT-37 / D1)

The design is ported from our earlier v1.2 prototype (`/Users/batyr/Documents/hotelapp/hotelapp-v1.2`, read only — nothing changed there). Plan change first: Linear D1 (ANT-37) and D2 (ANT-38) were created as High-priority sub-issues of ANT-5, and `docs/PROJECT_MAP.md` now orders M5 → D1 → D2 → M6 → M7 → M8 → M9 → M10 (then M2 → M11 → M12).

What I built (simple words): The app now looks like the v1.2 design. Deep-teal brand color, brass/amber accent, one color per status, Instrument Sans for text and Bricolage Grotesque for headings (the same bundled font packages the v1.2 prototype uses), and the same buttons, cards, badges, avatars and logo. The guest page got the v1.2 phone look: dark-teal header with "Welcome / Room 204 / How can we help?" and a white card over it; on desktop it sits in a centered phone-width frame. The staff board uses the same cards, badges (Urgent/Soon/When possible, status colors), avatars with the v1.2 role colors, the dark AI-issues box and green "no problems" box from the v1.2 cleaner screen. Same features as before — nothing removed: guest text + voice, task confirmations, staff picker, photos, AI photo check, Send to review all work exactly as before. This app stays Next.js; no v1.2 pages with fake data were copied.

Files changed:
- `docs/PROJECT_MAP.md` — new order M5 → D1 → D2 → M6… with D1/D2 rows (ANT-37/ANT-38)
- `src/app/globals.css` — v1.2 design tokens as Tailwind v4 `@theme` (brand/ink/line/status colors, fonts, card/pop/ring shadows, 14px card radius) + base styles from v1.2 `src/index.css`
- `src/components/ui.tsx` — new: shared components ported from v1.2 `src/components/ui/index.tsx` (Button, Field/Input/PasswordInput/Textarea, Card/CardHead, Badge with the v1.2 tones, Avatar with v1.2 role colors, Logo — the same logo mark)
- `src/app/layout.tsx` — loads the two bundled variable fonts, canvas/ink body colors
- `package.json`, `package-lock.json` — `@fontsource-variable/instrument-sans`, `@fontsource-variable/bricolage-grotesque`, `lucide-react` (same packages as v1.2)
- `src/app/r/[room]/page.tsx` — v1.2 guest frame + brand-950 header
- `src/app/r/[room]/GuestForm.tsx` — form in a v1.2 Card, shared Textarea/Button (Mic dark button with icon, Send primary), status Badges, soft alert boxes
- `src/app/staff/page.tsx` — Logo header in the v1.2 style
- `src/app/staff/StaffBoard.tsx` — picker Cards with Avatars + red new-task badges, status columns (review column in the v1.2 inspection purple), task Cards with priority Badges, photo/AI blocks in v1.2 tones, shared Buttons
- `src/app/page.tsx` — home page uses Logo/Card/Buttons
- `README.md` — design-port note
- `DEVLOG.md` — this entry

Linear:
- ANT-37 (D1) — taken by Meta1 ("Meta1: taking this"), In Progress, then Done with a summary comment. ANT-38 (D2) created Todo for the next step.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok.
- Browser on /r/204 (production server, port 3100): page text shows the v1.2 header; computed styles prove the fonts really load (body "Instrument Sans Variable", heading "Bricolage Grotesque Variable") and Send uses brand-700 `#0C5560`. Sent "There is a leak in the bathroom and please bring towels" through the page: LIVE AI created both tasks, confirmations show "Received" badges, no console errors. (One first load hit a stale-server chunk error because an old server from the previous session still held port 3100; after restarting on the new build everything loads clean.)
- Browser on /staff: picker shows Avatars/role colors, the active person (Aigerim, from the saved picker choice) has the brand-700 background, red new-task badges show, the started housekeeping task still shows Photos (1/3), "AI photo check / Not checked yet / Run AI photo check" and "Send to review" — photos, AI check and review features intact in the new look. No console errors.
- Responsive: at a true 375px and 1440px width (measured in frames) both /r/204 and /staff have no sideways scroll (`scrollWidth` = width). Guest screenshot at phone width and staff screenshot look like the v1.2 design.
- Test data cleaned up afterwards: the 2 tasks created by the browser test were removed and the pre-existing saved tasks restored untouched (`.data` is git-ignored).

NOT working / NOT checked yet:
- D2 (sign-in and role screens) is not built yet — /staff still uses the "Who are you?" picker in this commit. That is the next step (ANT-38), a separate commit.
- Voice was not re-recorded in this step (the Mic button and flow are unchanged code, only restyled); a real-phone check is still open from before.
- Only English, as planned. The v1.2 guest tiles (food, items, problem types, chat, info) are LATER screens and were not copied, on purpose.
- Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-37, sub-issue of ANT-5 (follow-up D2 = ANT-38)

## Meta1 — 2026-10-31 — SAM 3.1 photo check API (ANT-21 / M5)

**Did the real sam-3.1 call work? YES.** With the key in `.env.local` (value never printed), `POST /api/tasks/<id>/ai-check` called the real Meta Model API and saved LIVE results (about 5 seconds per task, 3 SAM requests per photo). What it returned for each test photo:

- **Bed WITH towels** (`.data/test-photos/bed-with-towels.jpg`): score **100/100** — Bed: found (83% sure, 2 found), Towels: found (71% sure, 4 found), Pillow: found (93% sure, 2 found). No issues.
- **Bed WITHOUT towels** (`.data/test-photos/bed-without-towels.jpg`): score **67/100** — Bed: found (85% sure), Towels: **not found**, Pillow: found (94% sure). Issue: "No towels found in the photo. Please check the work and take a new photo if needed."

Both results make sense. The same LIVE results were still on the tasks after a server restart.

Official docs read first (no guessing): SAM overview https://dev.meta.ai/docs/sam/overview, media segmentation https://dev.meta.ai/docs/media-segmentation, segmenting with prompts https://dev.meta.ai/docs/sam/segmenting, reading output https://dev.meta.ai/docs/sam/reading-segmentation, Responses API https://dev.meta.ai/docs/protocols/responses. Exact wire format: `POST https://api.meta.ai/v1/responses`, model `sam-3.1`, Bearer `MODEL_API_KEY`, body `{model, input:[{type:"message",role:"user",content:[{type:"input_text",text:"<one short noun phrase>"},{type:"input_image",image_url:"<public URL or data:image/...;base64,...>"}]}], metadata:{include_confidence:"true", mask_encoding:"one_bit"}}`. One concept per request, so each check is its own request. The answer text (`output[].content[].text`) is `text<0f>id<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..;c=..|><|mask;...|>` per match; empty text = nothing found (a valid answer, not an error). Confidence `c` only comes when `include_confidence` is the string `"true"`.

Test photo sources (free license, saved only in `.data/test-photos/`, git-ignored, never committed):
- With towels: "0504dahab 0080" by Geoff Clark, Wikimedia Commons https://commons.wikimedia.org/wiki/File:0504dahab_0080_(138559655).jpg, CC BY 2.0 https://creativecommons.org/licenses/by/2.0 (towel swans on the beds)
- Without towels: "Hotel beds" by Sridhar Rao, Wikimedia Commons https://commons.wikimedia.org/wiki/File:Hotel_beds.jpg, CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0 (made bed, pillows, no towels)

What I built (simple words): SAM finds objects in a photo; it does not judge work and it never approves anything — the saved result only helps the supervisor. Each team has a short check list in one place (`PHOTO_CHECKS` in `src/lib/photo-check.ts`: housekeeping = bed/towels/pillow, maintenance = sink/toilet, front desk = desk/chair, room service = tray/plate/cup — change that one list to change the checks). The result is saved on the task: score 0–100 (share of checks found, "not sure" counts half), each check Found / Not found / Not sure with SAM confidence and count, issues in plain words, model name, LIVE/MOCK mode and time. If SAM confidence is below 0.5 the check says "not sure" — never pass or fail (there is no pass/fail verdict at all). With no key, or any model error (tested: a wrong key gets HTTP 401 from Meta), the route saves a clearly marked MOCK result (model `sam-3.1 (MOCK — not called)`, every check "not sure", issue "This is a MOCK result — no AI checked this photo. A person must look at the photo.") and the flow still works. Adding or deleting a photo clears the old check, because it no longer matches the photo set. Smallest UI only: on `/staff` a task with photos shows an "AI photo check" block (score, MOCK badge, checks, issues, "only helps the supervisor" note) and a **Run AI photo check** button. No screen redesign; retake/gating is M6.

Files changed:
- `src/lib/photo-check.ts` — new: THE check list (one place), SAM request/parse/score code, MOCK builder; docs links and the exact wire format in the header comment
- `src/app/api/tasks/[id]/ai-check/route.ts` — new: POST ai-check; 404 unknown task, 409 no photo / missing photo file; reads photo bytes via `src/lib/photos.ts`, sends data URLs, saves LIVE or MOCK result; never changes task status
- `src/lib/tasks.ts` — `TaskAiCheck` / `AiCheckItem` types, `aiCheck` field on the saved task
- `src/lib/store.ts` — saves/loads `aiCheck` (old saved tasks load with null), `saveStoredTaskAiCheck`, photo add/delete clears `aiCheck`
- `src/app/staff/StaffBoard.tsx` — smallest UI: Run button + result block on tasks with photos
- `README.md` — AI photo check explained
- `DEVLOG.md` — this entry
- Not committed (git-ignored): `.data/test-photos/bed-with-towels.jpg`, `.data/test-photos/bed-without-towels.jpg`

Linear:
- ANT-21 (M5) — shared task, taken by Meta1 ("Meta1: taking this" + the docs links), In Progress, then Done with a summary comment.
- ANT-36 "Test photo check with real room photos (owner)" — new sub-issue of ANT-5, Todo, Medium priority. Done when: owner uploads 2 real photos (bed with towel, bed without) and the results make sense.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok (new route `/api/tasks/[id]/ai-check` built).
- Parser/scoring unit check (compiled the one lib file and ran it in node): a box with `c=0.30` parses to count 1 / confidence 0.30 and builds an "unsure" check (score 50 for 1 unsure check) with the issue "Not sure about towels — the AI confidence is low, so a person should look at the photo."; empty text parses to count 0; Responses `output[].content[].text` extraction works; MOCK builder gives mode MOCK, all checks unsure.
- LIVE API test on a fresh server (port 3100): two housekeeping tasks made through the real guest API, Accept → Start, one sample photo uploaded to each, then `POST ai-check` — results exactly as written at the top of this entry (WITH = 100, towels found 71%; WITHOUT = 67, towels not found + plain issue). Results were identical on a second run and still saved after a server restart.
- Error paths: unknown task → 404; task with no photo → 409 "Add at least 1 photo before running the AI photo check."
- MOCK tests: server with no key → saved MOCK (score 50, all checks unsure, MOCK warning issue); server with a wrong key → Meta answered HTTP 401, route logged "SAM photo check failed, saving MOCK result: SAM API returned HTTP 401" and still saved the clearly marked MOCK result with HTTP 200.
- Browser test on /staff (Aigerim): both test tasks showed "Score: 100/100" and "Score: 67/100" with Bed/Towels/Pillow lines, confidence % and the "No towels found..." issue; clicking **Run AI photo check** on a third started task ran the check through the page (network shows the ai-check call, result appeared, no console errors). No MOCK badge on LIVE results.
- Responsive: at a true 375px and 1440px width (measured in frames) /staff has no sideways scroll (`scrollWidth` = width) and the AI check block is present.
- Test data cleaned up afterwards: my 3 test tasks and their uploaded photo copies were removed and the pre-existing saved tasks restored untouched (`.data` is git-ignored; the 2 sample photos stay in `.data/test-photos/`).

NOT working / NOT checked yet:
- Low-confidence "not sure" from the real SAM was not seen live — both sample photos gave clear found/not-found answers. The unsure path is unit-checked and is also what MOCK shows; ANT-36 (owner real photos) may hit it.
- SAM checks only whether objects are visible in the photo. It cannot tell if a bed is made well or a leak is fixed — the supervisor still judges the work. Checks for maintenance/front desk/room service are simple object presence only.
- Only the first confident find per check is used (extra photos are skipped for that check to save calls); a check runs over all task photos until then. One photo = 3 SAM calls for housekeeping; timing was ~5 s per task in tests.
- The sample photos are stock photos, not real room photos — that owner test is ANT-36. A real phone photo is not checked.
- Retake (clear photos + AI result) and "can only send to review after a check ran" are M6, not built here. The supervisor page is M7.
- Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1). Photo check model tested live: sam-3.1 (Meta Model API)
Linear: ANT-21, sub-issue of ANT-5; follow-up ANT-36

## Meta1 — 2026-10-31 — Review status end to end (ANT-20 / M4)

What I built (simple words): Staff can no longer finish a task by themselves. After Start and at least 1 photo, the button is now "Send to review" (it stays greyed out with the hint "Add at least 1 photo to send to review." until a photo exists). The task then sits in a new, clearly marked "In review" column — "Waiting for supervisor". A supervisor approves it to Done or sends it back to In progress with a short note; staff see that note on the task ("Sent back by supervisor: ..."), can fix the work and send it to review again. The supervisor page itself comes in M7 — for now approve / send back works through the API: `PATCH /api/tasks/<id>` with `{"action":"approve"}` or `{"action":"send_back","note":"..."}`, also as `{"status":"review"|"done"|"in_progress","note":"..."}`. The guest still sees only simple words: Received → On the way (also while In review, and after a send-back) → Done only after approval.

Files changed:
- `src/lib/tasks.ts` — new `review` status ("In review"), flow text, `reviewNote` (supervisor note, null otherwise) on the saved task
- `src/lib/store.ts` — allowed moves are now New → Accepted → In progress → In review → Done, plus In review → In progress (send back); sending to review needs at least 1 photo (else `photo_required`), sending back needs a short note (else `note_required`, max 500 chars), note is saved on send-back and cleared on resubmit/approve; old saved tasks without `reviewNote` load with null
- `src/app/api/tasks/[id]/route.ts` — actions `accept`, `start`, `send_to_review`, `approve`, `send_back`; friendly errors: 409 "Add at least 1 photo before sending this task to review.", 400 "Please add a short note when sending a task back.", 409 for wrong steps (direct Done from In progress is refused)
- `src/app/staff/StaffBoard.tsx` — 5 status columns; "Send to review" button (disabled with no photo + hint), highlighted In review column with "Waiting for supervisor" on the column and the task, supervisor note box on sent-back tasks, Done stays a plain "Done ✓" label
- `src/app/staff/page.tsx` — header text now says Accept, Start, add a photo, Send to review; a supervisor approves it to Done
- `src/app/r/[room]/GuestForm.tsx` — guest wording: `review` shows as "On the way" (same as In progress); Done only from the real `done` status
- `README.md` — review flow and the approve/send-back API explained
- `DEVLOG.md` — this entry

Linear:
- ANT-20 (M4) — shared task, taken by Meta1 ("Meta1: taking this"), In Progress, then Done with a summary comment.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok.
- API test on a fresh server (port 3100): created tasks through the real guest API; Done straight from New and from In progress returned 409; Send to review with no photo returned 409; with a photo it moved to `review`; `send_back` with no note returned 400, with a note it returned to `in_progress` with the note saved; `approve` from In progress returned 409; resubmit cleared the note, `approve` from In review moved it to `done`. Old saved tasks (no `reviewNote` in the file) loaded fine with `reviewNote: null`.
- Browser test on /staff: In review column (amber, "Waiting for supervisor") held the review task, the sent-back task showed "Sent back by supervisor: Photo is blurry, please retake closer.", clicking its "Send to review" button moved it to In review and cleared the note, and a started task with no photo had "Send to review" disabled with the hint. No console errors, no "Done" button anywhere.
- Browser test on /r/204: sent a message ("Received"), moved its task through Accept → Start → photo → Send to review via API — guest page changed to "On the way" and stayed there in review; after API `approve` it changed to "Done" by itself. No console errors.
- Responsive: 1440px screenshot — 5 columns side by side, review column clearly highlighted, note and photos visible. At a true 375px width (measured in a 375px frame) staff and guest pages have no sideways scroll (`scrollWidth` = 375); headless-Chrome 375px screenshots looked clipped due to window sizing, so the frame measurement is the reliable check.
- Test data cleaned up afterwards: the tasks/photos created for these tests were removed and the pre-existing saved tasks restored untouched (`.data` is git-ignored).

NOT working / NOT checked yet:
- No supervisor page yet (that is M7 / ANT-23) — approve / send back was tested through the API only, as planned for this task.
- AI photo check gating (M6) is not in yet: sending to review needs a photo, not an AI check.
- A real phone is not checked — layout was checked at 375px width in the browser as above.
- Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-20, sub-issue of ANT-5

## Meta1 — 2026-10-31 — Photo upload on staff tasks (ANT-19 / M3)

What I built (simple words): Staff can now prove finished work with photos. On /staff, after pressing Start on a task, an "Add photo" button appears: on a phone it opens the camera, on a desktop it opens a file picker. A task takes 1–3 photos. Photos show as small pictures on the task, a click opens them full size, and the × on a photo deletes it. The photo files are saved on this Mac in `.data/photos` (never in git) and are still there after the server restarts. All photo saving and reading lives in one small file, `src/lib/photos.ts` — when photos move to cloud storage later (M11), only that file changes.

Files changed:
- `src/lib/photos.ts` — new: the one photo helper (save / read / delete photo files in `.data/photos`, allowed photo types, 10 MB size limit, 3-photos-per-task limit value, safe file names so no path tricks)
- `src/app/api/tasks/[id]/photos/route.ts` — new: POST saves one photo to a started (in_progress) task, DELETE removes one (`?name=...`); friendly errors (404 unknown task, 409 not started / already 3 photos, 415 not a photo, 413 too big)
- `src/app/api/photos/[name]/route.ts` — new: serves one saved photo (reading only through the helper)
- `src/lib/tasks.ts` — `photos` list on the saved task (name, url, type, size, time)
- `src/lib/store.ts` — photo list saved in `.data/tasks.json`; old saved tasks without photos get an empty list; add/remove photo with the 3-photo limit; "Reset demo data" also deletes the photo files
- `src/app/staff/StaffBoard.tsx` — photo area on started tasks: counter (n/3), thumbnails, full-size link, delete ×, "Add photo" with `accept="image/*"` + `capture="environment"` (phone camera), "Max 3 photos" note; Done tasks keep their photos visible read-only
- `README.md` — photo proof explained
- `DEVLOG.md` — this entry

Linear:
- ANT-19 (M3) — taken by Meta1 ("Meta1: taking this"), In Progress, then Done with a summary comment. Its description was first updated for the plan change (no M2 dependency, local `.data/photos`).

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok (new routes `/api/tasks/[id]/photos` and `/api/photos/[name]` built).
- API test on a fresh server (port 3100): guest message made a task (LIVE), upload before Start returned 409; after Accept → Start, two photos uploaded (201 each); a text file returned 415; a 3rd photo was accepted and a 4th returned 409 ("already has 3 photos"); the served photo bytes were identical to the uploaded file (same SHA-256).
- Delete test: deleting one photo removed it from the task, deleted the file from `.data/photos`, and its URL then returned 404.
- Restart test (the required one): killed and restarted the server — the task still listed 2 photos and both photo URLs answered 200 with the same bytes.
- Browser test on /staff: the started task showed "Photos (2/3)" with both pictures loaded and no console errors; adding a third photo through the page's own file input (a real file sent into the input) made it "Photos (3/3)" with the "Max 3 photos" note; at a true 375px width (measured in a 375px frame) there is no sideways scroll, pictures load, and the file input has `accept="image/*"` + `capture="environment"`. Desktop 1440px headless screenshot: photo thumbnails, delete buttons and "Add photo" sit correctly in the In progress column.
- `git check-ignore` confirms `.data/photos` is ignored (`.data/` rule), so no photo can be committed.
- Test data cleaned up afterwards: my test task and its 3 photo files were removed by hand; the older saved tasks were left untouched.

NOT working / NOT checked yet:
- A real phone camera photo (HEIC from an iPhone) is not checked — only PNG files were used in tests. JPG/PNG/WEBP/GIF/HEIC are accepted by type; the camera flow on a real phone needs a human test.
- The task still goes straight to Done after photos — sending it "to review" is M4/M6, not this task. The "Retake photos" button (clear all photos + AI result) also comes with M6; here staff delete photos one by one.
- Photos are local files on this Mac only; cloud storage is M11 (only `src/lib/photos.ts` changes then).
- Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-19, sub-issue of ANT-5

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
