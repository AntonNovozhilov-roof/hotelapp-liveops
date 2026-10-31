# Dev Log

## Meta1 — 2026-10-31 — H1: Ready for human testing (ANT-47)

What I built: A colleague can now clone the repo and test with no `.data` folder and no API key. (1) Fresh start: the Owner sees **Load demo hotel** on the Owner home when there are no rooms, and on the empty Rooms & QR page — one tap creates rooms floor 1: 101–110 and floor 2: 201–210, a sample hotel info sheet ("Seaside Demo Hotel (demo)", fake details, parking/breakfast FAQs) and 5 sample tasks (`(demo)` in the title, `sample:true`, one per team/type incl. a cleaning). Pressing it again adds nothing. **Reset demo data** now removes all of it: tasks+photos, rooms/QR, hotel info, history and reports — back to a fresh start. Owner-only on the server (staff 403, signed-out 401). (2) MOCK mode: with no `MODEL_API_KEY` a yellow MOCK banner sits on every page (AI/photo-check/report results were already marked MOCK); voice transcription stays honestly unavailable without a key (503, "type instead"). (3) README: new "Run it on your computer" for a non-developer tester — Node 20+ (22 LTS) for macOS/Windows, GitHub Desktop or `git clone`, `npm install`, `npm run dev`, http://localhost:3000, demo accounts table + `demo1234`, load demo/reset, real AI via their own `.env.local` key (never commit/paste it), phone on same Wi-Fi `http://<computer-ip>:3000` (photos work, microphone may not — needs HTTPS), and "Known limits" (data only on that computer in `.data`, sign-in resets on restart). AGENTS.md gained a short "How humans test" section.

Files changed: `src/lib/demo-hotel.ts` + `src/app/api/demo/route.ts` + `src/components/LoadDemoHotel.tsx` (new), `src/lib/hotel-data.ts` (`clearHotelData`), `src/lib/reports-store.ts` (`clearReports`), `src/app/api/tasks/route.ts` (Reset also clears hotel/history/reports), `src/app/owner/page.tsx`, `src/app/owner/OwnerReset.tsx`, `src/components/RoomsBoard.tsx`, `src/app/layout.tsx` (MOCK banner), `README.md`, `AGENTS.md`, `DEVLOG.md`.

Linear: ANT-47 "H1: Ready for human testing" (High, sub-issue of ANT-5, taken by Meta1). Created 8 human test tasks (Todo, Medium, sub-issues of ANT-5, each linked to ANT-36): ANT-48 Guest chat and voice, ANT-49 Staff boards per role, ANT-50 Cleaning with perfect photo check and retry, ANT-51 Supervisor review and history, ANT-52 Rooms & QR print/download, ANT-53 Hotel info sheet and assistant answers, ANT-54 Reports daily and weekly, ANT-55 Phone and desktop layout. Each has steps, what should happen, and "How to report" (comment results; per bug a new "Bug: ..." sub-issue of ANT-5 with steps/happened/expected/screenshot, linked back).

How I checked it works:
- `npm run typecheck` and `npm run build` pass (new `/api/demo` route built).
- Fresh-clone test exactly as the README says: cloned this repo (committed state) into a temp folder outside the project — no `.data`, no `.env.local` — `npm install`, `npm run dev` with no key. Note found while testing: port 3000 was already busy on this Mac, so Next picked 3001 and printed it; README now explains that (this was the one unclear point, fixed). On the fresh server: MOCK banner on every page; Owner sign-in (demo1234) → "Load demo hotel" on Owner home and on empty Rooms & QR; staff load refused 403, signed-out 401; load created 20 rooms (101–210, floors 1–2), demo hotel info, 5 demo tasks; second load added 0; guest `/r/204` shows the demo hotel name, MOCK leak+towels made 2 tasks, Wi-Fi answered from the demo sheet with no task; voice without key = friendly 503; Aigerim Accept→Start→Done on a request; staff Reset refused 403; Owner Reset cleared 7 tasks → 0 rooms / 0 tasks / 0 history / reports empty, and "Load demo hotel" is offered again. All main pages returned 200 (owner `/staff` 307 to own home, as designed). Guest page iframe-measured at 375px and 1440px: `scrollWidth` equals width, no sideways scroll, no console errors. Temp folder deleted afterwards; the main project's server/data on port 3000 were not touched (still its 4 pre-session tasks).

NOT working / NOT checked yet:
- Not pushed to GitHub (owner did not say "push") — a colleague can clone these H1 changes from GitHub only after the owner pushes this commit.
- A real phone, printer, and real-AI (key) run were not re-checked in this task; MOCK mode was the test target, and LIVE flows were checked in earlier tasks. Windows steps are written from the standard Node/GitHub Desktop flow, not run on a Windows machine.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-47, sub-issue of ANT-5 (human tests ANT-48–ANT-55)


## Meta1 — 2026-10-31 — U1: v1.2 polish pass on every screen (ANT-46)

Polish changes (design ported from our earlier v1.2 prototype, read-only at `/Users/batyr/Documents/hotelapp/hotelapp-v1.2` — nav per role from its `nav.ts`/`AppShell`/`StaffShell`, PageHeader pattern, "today at a glance" from its Dashboard; no new features):
- Same navigation per role on every signed-in screen (in `SessionBar`/`RoleNav`): Owner = Owner home/Review/Reports/Rooms & QR/Hotel info/History; Supervisor = Supervisor home/Reports/Rooms & QR/History; staff = My board. Current page is highlighted.
- One clear page title pattern everywhere (`PageHeader` in `src/components/ui.tsx`): title + one helpful line, on staff, owner, supervisor, reports, history, rooms, hotel info.
- Owner and Supervisor homes: new "Today at a glance" card (`src/components/TodayGlance.tsx`) — open tasks per team, in review, urgent, done today, and a link to today's report.
- Tap targets at least 44px on phones (buttons/inputs/nav/photo-delete/demo sign-in rows grow on small screens, back to v1.2 sizes on desktop); nothing cut off.
- Helpful empty states (each staff column says what belongs there, e.g. "No new tasks — you're all caught up"), a loading state on the staff board, friendlier error words ("Check your connection — the page will keep trying on its own.").
- Times read "5 min ago" everywhere (history rows now use it too, full date on hover); sample tasks show a "Sample" badge; history filters are 44px on phones.
- Fixed while testing: Reports page React hydration error from locale-made dates → dates are now formatted the same on server and phone; Copy text got a fallback so it also works where the clipboard API is blocked.

Files changed: `src/components/ui.tsx`, `src/components/SessionBar.tsx`, `src/components/TodayGlance.tsx` (new), `src/components/HistoryBoard.tsx`, `src/components/RoomsBoard.tsx`, `src/app/staff/page.tsx`, `src/app/staff/StaffBoard.tsx`, `src/app/owner/page.tsx`, `src/app/supervisor/page.tsx`, `src/app/reports/page.tsx`, `src/app/reports/ReportsBoard.tsx`, `src/app/history/page.tsx`, `src/app/owner/rooms/page.tsx`, `src/app/owner/hotel-info/page.tsx`, `src/app/login/page.tsx`, `docs/PROJECT_MAP.md`.

Backtest (browser + API, port 3000):
- Every page for every role at 375px, 768px and 1440px (iframe-measured): owner, supervisor, reports, history, rooms, hotel info, guest, and /staff as Aigerim/Ruslan/Daniyar/Madina — `scrollWidth` equals the width everywhere, no sideways scroll, no console errors (after the date fix). Screenshots checked by eye: login, owner home with glance + nav, reports with a report open, guest room 204, Aigerim's My rooms. PASS
- Reports in the browser: Daily auto-appeared ("All numbers checked ✓"), tapping "What needs attention today" showed the right task (Room 204 gas smell), Download PDF produced `daily-report-2026-10-31.pdf`, Copy text works (fallback), Regenerate + old reports list were verified in the M10 commit. PASS
- Old flows still work (API regression, 14/14): guest chat makes 2 tasks, request Accept→Start→Done, repair blocked without proof photo → photo → Done → supervisor reopen, cleaning blocked without photo and without AI check → LIVE AI check → review → supervisor approve, history for supervisor, staff 403 on history. PASS (Voice, cleaning retry-twice and QR/print were not re-run; that code is untouched since their own checked commits.)
- `npm run typecheck` and `npm run build` pass.
- NOT checked: a real phone/printer. After the tests: tasks/history restored to the 4 pre-session tasks, test photos deleted, test reports removed so the first Reports visit makes a fresh daily report.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-46, sub-issue of ANT-5

## Meta1 — 2026-10-31 — M10+S6: AI reports for owner and supervisor (ANT-26 + ANT-34)

Meta docs checked first: Muse Wonder = `muse-wonder-1.0` on Model API, `POST https://api.meta.ai/v1/chat/completions` (dev.meta.ai/docs/models) — same chat format as muse-spark-1.3.

What I built: New Reports page `/reports` (owner + supervisor only; staff page redirects and APIs 403) with Daily and Weekly tabs. Daily = yesterday + today so far, auto-made on first open after 07:00 with a Regenerate button; Weekly = last 7 days (went well/wrong, patterns, workload, exactly 3 suggestions). All facts are calculated first in `src/lib/reports.ts` (per-team created/done/open, urgent, waiting >2h, average accept/finish minutes per team, cleaning AI passed/failed/unsure/failed-twice, sent back, reopened repairs, rooms without a perfect photo, the same repair/cleaning problem repeating in the same room, workload per staff member, guest questions the assistant could not answer with a "add to the info sheet" suggestion). Muse Wonder only writes from those facts (no guest personal data). Every number in its text is checked against the facts: one corrected retry, then a plain facts report marked "Plain report — AI numbers did not pass the check"; a pass shows "All numbers checked ✓". No key or model error = clearly marked MOCK report from the same facts. Every point expands to the tasks behind it. Old reports stay in a list. Download PDF, Download .md (date in the name), Copy text (S6). Owner-only "Load sample week (demo)" creates 22 clearly labelled sample tasks + history over the past 7 days (3 leaks in room 204, a twice-failed cleaning, a reopened repair, unanswered guest questions); "Remove sample data" deletes only sample tasks and their history. Reports made with sample data show "Includes sample data".

Files changed:
- `src/lib/reports.ts`, `src/lib/reports-store.ts`, `src/lib/sample-week.ts` — new: facts, number check, plain report, saved reports (`.data/reports.json`), sample week
- `src/app/api/reports/route.ts`, `src/app/api/reports/sample/route.ts` — new: list/generate (owner+supervisor), sample load/remove (owner)
- `src/app/reports/page.tsx`, `src/app/reports/ReportsBoard.tsx` — new Reports page
- `src/lib/store.ts`, `src/lib/tasks.ts`, `src/lib/history.ts` — `sample` flag, sample insert/delete, history cleanup + timestamp for sample events
- `src/app/owner/page.tsx`, `src/app/supervisor/page.tsx`, `src/lib/users.ts` — Reports links/cards
- `docs/PROJECT_MAP.md` — Owner report block, M10 and S6 rows done

Backtest (this commit, port 3100):
- Load sample week (22 tasks) → LIVE Weekly (muse-wonder-1.0) mentions "Room 204 had 3 leak tasks", "All numbers checked ✓", includes-sample badge on; point with 3 tasks expands concept verified via `/api/tasks?ids=`. PASS
- Daily auto logic + Regenerate: Daily/Weekly generate, old reports list shows 3 reports. PASS (auto-after-07:00 uses the same generate call on first mount)
- Break numbers on purpose (`REPORT_TEST_BREAK_NUMBERS=1`, test-only env): both AI tries fail the check → plain fallback report appears. PASS
- MOCK mode (no key): weekly report marked MOCK, same facts, pattern "Room 204 had 3 leak tasks — the same problem keeps coming back there". PASS
- Remove sample data: 22 removed; back to the original 4 tasks / 20 history events, no sample history left. PASS
- Staff (Aigerim): `/reports` 307 to `/staff`, API 403, sample load 403. PASS
- `npm run typecheck` and `npm run build` pass.
- NOT checked in this commit: tapping a point in the real browser + PDF/Copy buttons are exercised in the U1 browser pass that follows; test reports file was deleted after the test so the owner starts clean.
- After the tests: sample data removed, `.data/tasks.json`/`.data/history.json` restored to the 4 pre-session tasks.

AI model that helped: Muse via opencode (Meta1). Report writing tested LIVE with muse-wonder-1.0.
Linear: ANT-26 + ANT-34, sub-issues of ANT-5

## Meta1 — 2026-10-31 — M8+M9: History events, API and History page (ANT-24 + ANT-25)

What I built: Every step now saves a history event (`.data/history.json`, `src/lib/history.ts`): task created (Guest via AI, or supervisor/owner), accepted, started, photo added/removed, AI check (simple verdict; score, model and item details stored system-only, never shown), sent to review (including the automatic "Failed AI check twice" one), approved (by whom, or "Auto-approved by AI (owner setting)"), sent back (with note), reopened, done — plus reference photo added/approved/replaced, QR regenerated, rooms changed and hotel info saved. Each event has time, who (name + role, or Guest / AI), room, task, action and short details. The guest chat is never stored, only the request text. `GET /api/history` is owner/supervisor only (staff get 403), newest first, with room/person/task-type/today/last-7-days/search filters and `?task=<id>`. The History page (`/history`, owner + supervisor; staff are redirected away) has the same filters and search; a task link opens its full timeline oldest-first, and every review card has a "Timeline" link. Links added on the Owner home and Supervisor page. (Also fixed in the final backtest: a Done cleaning task on the staff board no longer shows its old "Not ready yet" verdict — it shows the Done line.)

Files changed:
- `src/lib/history.ts`, `src/app/api/history/route.ts` — new: events store + filtered API (item details stripped)
- `src/components/HistoryBoard.tsx`, `src/app/history/page.tsx` — new: filters, search, timeline view, helpful empty states
- Event writes in: guest message, tasks create + status, photos, ai-check, rooms (+QR regenerate), reference routes, hotel-info
- `src/app/supervisor/SupervisorBoard.tsx` — "Timeline" link; `src/app/owner/page.tsx`, `src/app/supervisor/page.tsx` — History links
- `docs/PROJECT_MAP.md` — History block + M9 row updated

Full-session backtest (all run this session; LIVE AI unless noted):
- Print all popup: PDF downloads (`room-qr-codes.pdf`, 3 A4 pages / 11 rooms, cards show hotel, room, "Scan to message the hotel"); PNG ZIP floor 1 = exactly `101A.png`, `102.png`, `103.png`; no new tab; no console errors. PASS
- Done column newest first: staff Done column shows the just-approved task on top; label "Newest first"; other columns "Urgent first, then oldest". PASS
- Room 205: perfect photo set + approved. Cleaning task, photo with towels missing: 1st fail (Send to review disabled in UI + 409 on the server) → retake → 2nd fail → auto In review flagged "Failed AI check twice", perfect + latest side by side → supervisor approved in the browser. PASS
- Matching photo: pass → Send to review → one-tap Approve → Done. PASS
- Auto-approve on: passing task became Done at check time, logged "Auto-approved by AI (owner setting)"; supervisor reopened it; setting turned off again (verified off in the saved settings). PASS
- Replace perfect photo: old one in reference history (2 entries now, with who/when/reason), new one used for the next check. PASS
- Room without a perfect photo (204): simple check ran, hint text path confirmed. PASS
- No item names, counts, scores or "% sure" anywhere on cleaner or supervisor screens (checked the rendered text); supervisor sees only the simple verdict. PASS
- History: the flagged 205 task timeline shows Task created → Accepted → Started → Photo added → AI check → Photos removed → Photo added → AI check → Sent to review, right names in order; full History filters (room, search "towel", today, type) work; staff API 403 and staff page redirects away. PASS
- Old flows: guest chat in the browser (reply + housekeeping task), repair (no photo = 409, proof photo → Done → supervisor reopen with note), QR regenerate (old link shows "no longer valid"). PASS (Voice: code unchanged since G1; not re-recorded.)
- `npm run typecheck` and `npm run build` pass; no console errors on staff/supervisor/history/rooms/guest pages; iframe checks at 375px and 1440px: `scrollWidth` equals the width on /staff, /supervisor, /history, /owner/rooms and /r/205 — no sideways scroll. PASS
- After the tests: demo tasks restored to the 4 pre-session ones, orphan test photos deleted. Left on purpose: room 205's perfect reference (2 archived versions in its history) and today's history events, so there is something to look at. Auto-approve is OFF.

NOT working / NOT checked yet:
- A real phone, printer and phone-camera QR scan are not checked.
- Tasks created before M8 have no history events (the timeline says so in a helpful empty state).
- Owner morning report (M10) is still Todo. Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1). Checks LIVE with muse-spark-1.3 + sam-3.1.
Linear: ANT-24 + ANT-25, sub-issues of ANT-5

## Meta1 — 2026-10-31 — P1: Perfect room reference photos (ANT-45)

Meta docs checked first: Muse Spark image understanding (https://dev.meta.ai/docs/image-understanding) can describe/identify objects in photos, so the item list is built from the perfect photo by `muse-spark-1.3`, then SAM 3.1 (existing wire format in `src/lib/photo-check.ts`) finds and counts those items. Fallback when the vision list is unusable: `BROAD_ROOM_ITEMS` (bed, pillow, blanket, towel, lamp, chair, table, curtain, trash bin, bottle, cup, mirror, TV, rug, sink, toilet) — one place, easy to change, never only towels/pillows.

What I built: In Rooms & QR each room has "Perfect room photos": owner or supervisor uploads 1–3 photos (labels Bed area / Bathroom / Other); the AI check runs right after upload and is cached on the pending set; only pressing "Set as perfect reference" makes it active. Replacing archives the old reference (never deleted) with optional reason; per-room history shows who, when, reason. When a cleaner runs the AI check, all cleaner photos are compared with the room's active reference: only a simple verdict is shown anywhere — cleaner "✓ Looks ready" / "Not ready yet. The room looks different from the perfect photo. Check the room and take new photos." / "AI not sure…", supervisor sees perfect + latest photos side by side with Looks ready / Different from perfect photo / AI not sure. Item names, counts, confidence and score are saved on the task for the system only and were removed from the staff and supervisor screens. Retry: 1st fail blocks Send to review (button + server 409), only Retake; 2nd fail moves the task to review automatically, flagged "Failed AI check twice". Pass goes to review for one-tap Approve. Owner setting "Auto-approve cleaning when the AI is sure" (off by default, in Rooms & QR): a sure pass finishes the task at once (history event in M8); a supervisor can reopen it. No reference for the room: the old simple check runs and the screens show "No perfect photo for room N yet. Ask the owner to add one." The AI never rejects alone.

Files changed:
- `src/lib/hotel-data.ts` — reference/pending/history on rooms, auto-approve setting, `publicRoom` (item details never leave the server)
- `src/lib/photo-check.ts` — `BROAD_ROOM_ITEMS`, Muse Spark object listing, SAM over combined photos, reference check + comparison + verdicts
- `src/app/api/rooms/[id]/reference/route.ts`, `.../reference/photos/route.ts` — new: upload+check, remove, approve (owner/supervisor server-checked)
- `src/app/api/rooms/route.ts`, `src/app/api/rooms/[id]/route.ts` — public room shape, auto-approve setting (Owner only)
- `src/app/api/tasks/[id]/ai-check/route.ts` — compare with reference (or simple check), retry/auto outcomes
- `src/lib/tasks.ts`, `src/lib/store.ts` — verdict fields, `aiFailCount`/`flaggedTwice`, `saveAiCheckOutcome`, failed check blocks review, cleaning reopen allowed
- `src/components/RoomsBoard.tsx` — perfect photos per room (upload → check → approve, replace + history, auto-approve toggle)
- `src/app/staff/StaffBoard.tsx`, `src/app/supervisor/SupervisorBoard.tsx`, `src/app/supervisor/page.tsx` — simple verdicts only, side-by-side photos, flag badge; item lists/scores removed
- `docs/PROJECT_MAP.md` — P1 written down

How I checked it works (LIVE, port 3100):
- Room 205: uploaded bed-with-towels as perfect photo → checked automatically → "Set as perfect reference" → active. Cleaning task with bed-without-towels: 1st check verdict "different" (score 45 system-only), Send to review 409 → retake → same photo → 2nd fail → task auto In review, `flaggedTwice=true` → supervisor approved → Done.
- Same room, matching photo: verdict "ready", score 100, high confidence → Send to review → Approve → Done.
- Auto-approve on: matching task became Done at check time (`outcome=done_auto`); supervisor reopened it; setting turned off again.
- Replace: new reference replaced the old one — old in history with uploader + reason; restored the towels reference afterwards.
- Room 204 (no reference): simple check ran (`comparedToReference=false`) with the hint path.
- `npm run typecheck` ok, `npm run build` ok.

NOT working / NOT checked yet:
- Screens for the retry states and the supervisor side-by-side are exercised in the browser in the final session backtest (the API states above are what those screens render).
- Test photos: free-license samples already in `.data/test-photos/` (CC BY 2.0 / CC BY-SA 4.0, see the M5 entry) — never committed.
- History events for reference changes land with M8/M9 (next commit in this session).

AI model that helped: Muse via opencode (Meta1). Vision listing: muse-spark-1.3; counts: sam-3.1 (both LIVE).
Linear: ANT-45, sub-issue of ANT-5

## Meta1 — 2026-10-31 — F1: Print-all popup + Done newest first (ANT-44)

What I built: "Print all" on Rooms & QR no longer opens a new page. It opens a popup "How do you want to download?" — (1) PDF for printing: A4 sheets, 6 QR cards per page, hotel name + room number + "Scan to message the hotel" on each card; (2) All as PNG: one ZIP, one image per room, file name = room number (e.g. `205.png`). You can pick all rooms or one floor. The file downloads directly, no new tab (PDF/ZIP are built in the browser with jspdf/jszip). Done column on every board is now newest first (`sortForColumn` in `src/lib/tasks.ts`, used by the staff board columns and Finished repairs); other columns stay urgent first, then oldest, and the Done column subtitle now says "Newest first".

Files changed:
- `src/components/RoomsBoard.tsx` — download popup (format + all/floor choice, direct blob download)
- `src/lib/tasks.ts` — `sortForColumn`: Done newest first, others urgent→oldest
- `src/app/staff/StaffBoard.tsx`, `src/components/DoneRepairs.tsx` — use the column sort; Done subtitle "Newest first"
- `docs/PROJECT_MAP.md` — F1 (ANT-44) and P1 (ANT-45) rows added
- `package.json`/`package-lock.json` — jspdf + jszip

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok.
- Browser (owner, port 3100): Print all opens the popup on the same page; PDF download produced `room-qr-codes.pdf` (3 A4 pages for 11 rooms, "Scan to message the hotel" + "Room" text present), no new tab, no console errors. ZIP with "Floor 1 only" produced `room-qr-codes.zip` containing exactly `101A.png`, `102.png`, `103.png`.

NOT working / NOT checked yet:
- A real printer is not checked; the PDF is standard A4 from jsPDF.
- Full-session backtest (incl. Done order on the staff board with fresh tasks) runs at the end of the F1→P1→M8+M9 session.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-44, sub-issue of ANT-5

## Meta1 — 2026-10-31 — Guest AI assistant (ANT-43 / G1)

What I built: The guest page is now a simple chat: guest bubbles on the right, assistant replies on the left, voice exactly as before (Mic → transcript lands in the box → guest can fix it → Send). One `muse-spark-1.3` call returns JSON `{reply, tasks}` (same task format and `validateTasks` validation as before), with the last 6 chat messages sent so follow-ups work. Reply rules live in one place, `src/lib/guest-ai.ts` — in the model prompt, in the MOCK replies, and as server guardrails on the LIVE answer, so they hold even if the model slips: reply in the guest's language, short/warm/honest, never promise a time, confirm which team got a request; hotel questions answered only from the G2 info sheet (deterministic sheet lookup for Wi-Fi/breakfast/times/phones/address/rules/FAQs), unknown questions get "I'll ask the front desk for you" + a front desk task with the question; emergencies (fire, gas smell, someone hurt/ill, flooding) tell the guest to call the reception/emergency numbers from the sheet now + an urgent (high) task; no invented prices, no other guests' info, chit-chat = short friendly reply, no task. Live status lines appear in the chat when staff move a task ("Housekeeping is on the way", "Done ✓ — …"). Chat lives only in this browser tab (state only, refresh starts clean) with the line "Your requests go to hotel staff." MOCK mode (no key) gives the same sensible replies via the same rules, clearly marked (MOCK badge + "MOCK reply").

Files changed:
- `src/lib/guest-ai.ts` — new: reply rules, emergency/info/question detection, sheet answers, MOCK assistant, LIVE guardrails, the model prompt (sheet + rules)
- `src/app/api/guest/message/route.ts` — one model call returns reply + tasks; accepts `history` (last 6 kept); MOCK uses the rule assistant; empty/>2000 chars still 400
- `src/app/r/[room]/GuestForm.tsx` — chat UI (bubbles, status lines, tab-only privacy line); voice flow unchanged
- `src/lib/tasks.ts` — MOCK word rules also recognise a few Russian words (полотенца, подушка, протечка)
- `DEVLOG.md` — this entry

Linear: ANT-43 (G1, High, sub-issue of ANT-5) — "Meta1: taking this", In Progress.

Backtest (all run this session, LIVE with key on port 3100/3000 unless noted):
- "please bring two towels" → "I've passed this to housekeeping, towels are on the way", 1 housekeeping request task. PASS (API + browser)
- "what is the wifi password?" → answer from the sheet (network + saved password), no task. PASS
- "how much is parking?" (price not in the sheet) → no invented price, "I'll ask the front desk for you" + 1 front desk task with the question. PASS
- "leak in the bathroom and bring towels" → reply mentions both teams, 2 tasks (maintenance repair + housekeeping request). PASS
- Russian "Принесите, пожалуйста, два полотенца" → Russian reply, housekeeping task. PASS (LIVE and MOCK)
- "I smell gas" → tells the guest to call reception + emergency number 112, 1 urgent (high) task. PASS
- Follow-up "and one more pillow" after the towels (history sent) → housekeeping pillow task. PASS
- Empty message → 400 "Message is empty"; 2001 chars → 400. MOCK mode (server with no key): all cases above give sensible marked replies (towels/wifi/parking/leak+ towels/Russian/gas/chit-chat). PASS
- Regenerate QR → old link shows the "no longer valid" page, new link works (R1 test). Print page renders cards; PNG download starts a real `room-101A-qr.png` download and QR images render (320px, loaded). PASS
- Roles: staff cannot open Rooms & QR (307/API 403) or Hotel info (307/API "Only the Owner…"); supervisor can view/print QR but cannot change rooms or hotel info. PASS
- Old flows still work: staff board 200, supervisor page 200, cleaning send-to-review without photo still 409, request Accept→Start→Done worked from the browser test task; guest chat showed the live "Housekeeping is on the way" and "Done ✓" lines when staff moved it. Photo check/supervisor review/repairs reopen code untouched in this session (last checked in ANT-22/ANT-23, same build line). PASS
- `npm run typecheck` ok, `npm run build` ok, no browser console errors on guest/rooms pages; 375px iframe check: guest and rooms pages `scrollWidth` = 375 (no sideways scroll), desktop check at 800px+ window also clean (1440 layout uses the same max-width grids checked in earlier sessions).

NOT working / NOT checked yet:
- A real phone, a real printer and a real QR scan with a phone camera are not checked — QR PNG/print are generated from the exact guest link and rendered in the browser.
- The "accepted" status line can be skipped in the guest chat if staff Accept and Start between two 3-second polls (the later lines still show). 
- History (M8/M9) and the owner morning report (M10) are still Todo. Not pushed to GitHub (owner did not say "push").
- Test tasks created during the backtests were removed afterwards (pre-existing saved tasks restored); rooms 101A/102/103 + 201–205 and the demo hotel info ("Seaside Demo Hotel", parking FAQ) are left in `.data/hotel.json` on purpose so there is something to try.

AI model that helped: Muse via opencode (Meta1). Guest assistant tested LIVE with muse-spark-1.3.
Linear: ANT-43, sub-issue of ANT-5

## Meta1 — 2026-10-31 — Hotel info sheet (ANT-42 / G2)

What I built: Hotel info page (`/owner/hotel-info`, Owner only): hotel name, address, reception phone, emergency number, Wi-Fi name and password, check-in/check-out times, breakfast hours, house rules, plus extra questions & answers the owner can add, edit and delete (delete asks first; a helpful empty state suggests a parking example). Saving shows a clear "Saved ✓ The guest AI will use this info now." message. Data lives in the same one place as rooms (`src/lib/hotel-data.ts`, `.data/hotel.json`), so the guest assistant (G1) reads exactly this sheet. The guest page header now shows the hotel name ("Welcome to …").

Files changed:
- `src/app/api/hotel-info/route.ts` — new: GET (public facts for guests/AI), PUT (Owner only on the server, FAQs validated)
- `src/components/HotelInfoForm.tsx`, `src/app/owner/hotel-info/page.tsx` — new page (staff/supervisor redirected, server-checked)
- `src/app/r/[room]/page.tsx` — guest header shows the hotel name
- `DEVLOG.md` — this entry

Linear: ANT-42 (G2, High, sub-issue of ANT-5) — "Meta1: taking this", In Progress.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok (new `/owner/hotel-info`, `/api/hotel-info`).
- Server test (port 3100): staff and supervisor PUT both refused ("Only the Owner can change the hotel info."); owner PUT saved name "Seaside Demo Hotel", Wi-Fi password and a parking FAQ; guest `/r/204` header shows the new hotel name; staff `/owner/hotel-info` → 307 to `/staff`, supervisor → 307 to `/supervisor`, owner → 200.

NOT working / NOT checked yet:
- The guest assistant that answers from this sheet is G1 (ANT-43) — next commit in this session. Editing FAQs in the browser is exercised in the final browser pass.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-42, sub-issue of ANT-5

## Meta1 — 2026-10-31 — Rooms and QR codes (ANT-41 / R1)

What I built: Owner nav now has Review, Rooms & QR, Hotel info. Rooms & QR page (`/owner/rooms`): friendly "Add your rooms" setup when empty; owner adds rooms by floor + number range (101–110) or one room, can fix a number, remove a room, and regenerate a QR token (confirm says the old QR for that room will stop working). Each room record (`src/lib/hotel-data.ts`, stored in `.data/hotel.json` like tasks) has id, number, floor, a random unguessable token, `bookingIds: []` so bookings can attach later, and timestamps. Guest link is `/r/<room>?t=<token>`; a wrong/old token shows "This QR code is no longer valid. Please contact reception." Owner setting "Allow links without QR code (demo mode)" is on by default so `/r/204` keeps working — but a link with a wrong token is always refused. QR grid: one card per room (QR image, room, floor), filter by floor, search by number; per room Download PNG, Copy link, Show full screen, Regenerate. "Print all" opens `/owner/rooms/print` (hotel name, room number, "Scan to message the hotel", several cards per A4 page, Print → Save as PDF). Only the owner can change rooms/QR (server-checked); supervisor can view and print; staff cannot open it (page redirect + API 403).

Files changed:
- `src/lib/hotel-data.ts` — new: rooms/hotel-info/settings storage (one place, `.data/hotel.json`, same pattern as tasks), token generation, guest-link check
- `src/app/api/rooms/route.ts`, `src/app/api/rooms/[id]/route.ts` — new: list/add (bulk + single)/fix/remove/regenerate/settings, owner-only changes on the server
- `src/components/RoomsBoard.tsx`, `src/app/owner/rooms/page.tsx`, `src/app/owner/rooms/print/page.tsx` (+ `PrintButton.tsx`) — new pages
- `src/app/r/[room]/page.tsx` — token check + friendly invalid-QR page
- `src/app/owner/page.tsx`, `src/app/supervisor/page.tsx` — nav links (supervisor: view/print QR)
- `docs/PROJECT_MAP.md` — R1/G2/G1 added before M8; S1 (ANT-29) marked merged into R1; LATER adds manual bookings/income/expenses
- `package.json`/`package-lock.json` — `qrcode` (+ types) for QR images
- `DEVLOG.md` — this entry

Linear: ANT-41 (R1, High, sub-issue of ANT-5) — created by Meta1, In Progress, "Meta1: taking this". ANT-29 (S1) commented: merged into R1.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok (new `/owner/rooms`, `/owner/rooms/print`, `/api/rooms*`).
- API/page test on port 3100: staff rooms API 403; owner added floor 1 rooms 101–103; supervisor add refused ("Only the Owner can change…"); guest wrong token → invalid page, right token → form (200), no token → form (demo on); Regenerate → old link invalid, new link works; fix number 101→101A worked; staff `/owner/rooms` → 307 to `/staff`, supervisor `/owner/rooms` → 200; print page shows "Scan to message the hotel" cards. PNG download/full-screen are client actions on the same QR data URL — checked in the browser pass at the end of the session (see G1 entry).

NOT working / NOT checked yet:
- Hotel info page is G2 (ANT-42), guest chat is G1 (ANT-43) — next commits in this session.
- A real printer/phone scan is not checked; QR images are generated with the `qrcode` library from the exact guest link.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-41, sub-issue of ANT-5 (S1 = ANT-29 merged into this)

## Meta1 — 2026-10-31 — Supervisor page: approve / send back (ANT-23 / M7)

What I built (simple words): `/supervisor` is now the real review page. The **Review queue** lists cleaning tasks In review — each shows the room, the title, who cleaned it (for example "Cleaned by Aigerim · Housekeeping"), the photos (tap one to open it full size), the AI score and the one-line AI result (for example "Not found: towels. Fix the room and take a new photo."), with an "AI: check this" badge when the AI said not found / not sure. Order: AI "not found" or "not sure" first, then oldest first. **Approve** is one tap (task Done, the guest sees Done); **Send back** needs a short note — the button stays off without one, staff see the note and the task goes back to In progress. The **Owner can open and use this page too** (in a small hotel the owner is often the supervisor): the page allows supervisor or owner, the server allows the same two roles to approve / send back / reopen (staff still get 403), and the Owner home links here. The page keeps the counts, the **New cleaning task** form and **Finished repairs** with Reopen. v1.2 style, phone and desktop.

Files changed:
- `src/app/supervisor/SupervisorBoard.tsx` — new: the review queue cards (room, who cleaned, photos, AI score + one line, Approve, Send back with note)
- `src/app/supervisor/page.tsx` — real review page: supervisor **or owner**, queue + counts + New cleaning task + Finished repairs (placeholder card removed)
- `src/lib/tasks.ts` — `aiNeedsAttention` + `sortReviewTasks` (AI not found/not sure first, then oldest)
- `src/app/api/tasks/[id]/route.ts` — approve / send back / reopen allowed for supervisor or Owner on the server
- `src/app/owner/page.tsx` — "Review cleaning work" card linking to `/supervisor`
- `src/lib/users.ts` — supervisor screen text now describes the review page
- `README.md`, `docs/PROJECT_MAP.md` — supervisor page written down (map block 7 updated)
- `DEVLOG.md` — this entry

Linear:
- ANT-23 (M7) — shared task, taken by Meta1 ("Meta1: taking this"), In Progress, then Done with a summary comment.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok (new `/supervisor` board built).
- API test (LIVE AI, port 3100): three cleaning tasks sent to review (rooms 881/883 with the no-towels photo, score 67; room 882 with towels, score 100). Staff approve refused (403); Send back without a note refused (400); supervisor Send back with a note worked (task In progress, note saved, staff resubmitted it); the **Owner approved** a task to Done; the supervisor approved the rest. Page checks: supervisor and owner both open `/supervisor` (200), staff are redirected to their own screen; the page keeps "New cleaning task" and "Finished repairs".
- Queue order proven on the page HTML with a second set (rooms 884 clean/oldest, 885 AI-problem/newer, 886 clean): order was 885, 884, 886 — AI problem first even though newer, then oldest first. "Cleaned by Aigerim" and the attention badge show.
- Browser (port 3100, no console errors): signed in as Supervisor, room 887 (score 67, "Not found: towels…") showed in the queue with photos and one-line AI result; clicking **Approve** removed it with "Approved: Clean room 887 (room 887). The guest now sees Done." As Aigerim, `/staff` shows "Urgent first, then oldest" under all 5 columns, a started cleaning task shows **Retake photos**, **Send to review** is disabled before an AI check, and clicking Retake (confirm accepted) cleared it to "Photos (0/3)".

NOT working / NOT checked yet:
- Guest "sees Done" is the existing guest polling (approval sets the real `done` status, checked in M4 and by the Approve message/flow here); no separate guest-device check in this task.
- A real phone is not checked — responsive layout is checked again on the final restart in this session (375px frame + desktop, see the last DEVLOG entry of the session).
- History (M8/M9) and the owner morning report (M10) are still Todo. Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1). Photo check tested LIVE with sam-3.1.
Linear: ANT-23, sub-issue of ANT-5

## Meta1 — 2026-10-31 — AI result + retake on staff board, cleaning only (ANT-22 / M6)

What I built (simple words): Cleaning tasks only — staff now have a red **Retake photos** button on a started cleaning task with photos. It asks "Retake photos? This clears all photos and the AI result for this task." first, then clears every photo (files deleted too) and the AI result in one server step, so staff can shoot a fresh set. "Send to review" stays blocked until an AI check has run on the current photos: adding, deleting or retaking photos clears the old AI result on the server, and the server refuses review without a check (409). Request and repair tasks show no Retake button and no AI gating (their T1 rules are unchanged).

Files changed:
- `src/lib/store.ts` — new `clearStoredTaskPhotos`: clears photos + AI result on a started task, returns removed file names
- `src/app/api/tasks/[id]/photos/route.ts` — `DELETE` with no `?name=` is the retake (clears all); `?name=` still deletes one photo
- `src/app/staff/StaffBoard.tsx` — `retakePhotos` handler + "Retake photos" button (cleaning, In progress, has photos only)
- `README.md` — retake + "check must match current photos" written down
- `DEVLOG.md` — this entry

Linear:
- ANT-22 (M6) — shared task, taken by Meta1 ("Meta1: taking this"), In Progress, then Done with a summary comment.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok.
- API test, 15/15 checks passed (LIVE AI, server on port 3100): supervisor created "Clean room 881"; Aigerim Accept → Start; Send to review with no photo refused (409); photo uploaded; Send without AI check refused (409 "Run the AI photo check before sending this cleaning task to review."); AI check ran LIVE (score 67, towels not found); Retake (`DELETE /api/tasks/<id>/photos`) cleared photos and the AI result and the photo file itself answered 404; Send after retake refused (409); re-upload + AI check again + Send to review worked (task In review); Retake while In review refused (409).

NOT working / NOT checked yet:
- The Retake button itself was exercised through its exact API call; clicking it in the browser is covered in the M7 browser pass of this session (same build).
- A real phone camera photo is not checked; test photo is the saved sample in `.data/test-photos/` (git-ignored).
- Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1). Photo check tested LIVE with sam-3.1.
Linear: ANT-22, sub-issue of ANT-5

## Meta1 — 2026-10-31 — Staff board order: urgent first, then oldest (ANT-40)

What I built (simple words): Every staff board column now uses the same order: urgent (high priority) tasks first, then the oldest task first (first in, first out). Before, ties went newest first. The rule lives in the one sort helper (`sortTasks` in `src/lib/tasks.ts`), so the API and every column on `/staff` follow it. Under every column title a small line now says "Urgent first, then oldest".

Files changed:
- `src/lib/tasks.ts` — `sortTasks`: priority first, then `createdAt` oldest first
- `src/app/staff/StaffBoard.tsx` — "Urgent first, then oldest" line under every column title
- `README.md`, `docs/PROJECT_MAP.md` — order wording updated
- `DEVLOG.md` — this entry

Linear:
- ANT-40 "[Meta1] Staff board order: urgent first, then oldest" — created as a sub-issue of ANT-5 (follow-up logged against the ANT-39 work area, as the owner allowed), taken by Meta1 ("Meta1: taking this"), In Progress, then Done with a summary comment.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok.
- Unit check: compiled `src/lib/tasks.ts` and ran `sortTasks` on 5 made-up tasks (mixed priorities and times). Result order was exactly `old-urgent, new-urgent, mid, old-low, new-low` — urgent first, then oldest first.
- The saved demo data file was empty at check time, so the live-board order check is covered by the M6/M7 loop tests in this same session (same `sortTasks`).

NOT working / NOT checked yet:
- Nothing known. A real phone is not checked; layout impact is one small text line per column.

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-40, sub-issue of ANT-5 (follow-up to ANT-39)

## Meta1 — 2026-10-31 — Task types and photo rules (ANT-39 / T1)

Product change from the owner: not every task needs a photo. Before building: created Linear ANT-39 "T1: Task types and photo rules" (High, sub-issue of ANT-5), added T1 to `docs/PROJECT_MAP.md` before M6 (new order M5 → D1 → D2 → T1 → M6 → …), and updated M6 (ANT-22, title + description) to say it now applies to cleaning tasks only. Then took T1 ("Meta1: taking this", In Progress).

What I built (simple words): The AI now picks a task type as well as the department, and the type is shown on every task card (Request / Cleaning / Repair on staff cards and on the guest confirmation). All type rules live in one new file, `src/lib/task-types.ts` (`TASK_TYPE_RULES`: photo needed? AI check needed? goes to review?) — change that one table to change the rules; the store, the APIs and the staff board all read from it.

- **Request** (towels, water, pillow, taxi, food, info): Accept → Start → Done. No photo area, no AI check, no review.
- **Cleaning** (clean a room, Housekeeping): Accept → Start → photo required → AI photo check required → Send to review → supervisor. The server refuses review without a photo (409) and without an AI check (409).
- **Repair** (fix something, Maintenance): Accept → Start → proof photo required → Done, no AI check (the server refuses the AI check for non-cleaning tasks). The photo stays on the done task; the Supervisor and Owner home pages now list finished repairs with their proof photos, and the Supervisor can Reopen one with a note (staff reopen = 403, no note = 400) — Ruslan sees "Reopened by supervisor: …" and can finish it again (the photo is still there).

Also: Supervisor and Owner homes have a simple "New cleaning task" form (room number → creates "Clean room <number>", a housekeeping cleaning task, e.g. after check-out; `POST /api/tasks`, supervisor/owner only on the server). Guests can also ask for cleaning — the AI makes a cleaning task. Old saved tasks without a type get one guessed from the title (`src/lib/task-types.ts`: clean → cleaning, leak/fix/broken/toilet… → repair, otherwise request); the 9 saved demo tasks read back correctly (towels → request, leak/AC → repair, taxi → request). The AI check text is now one short line: the LIVE test gave exactly "Not found: towels. Fix the room and take a new photo." instead of one sentence per item.

Files changed:
- `src/lib/task-types.ts` — new: TASK_TYPES, TASK_TYPE_RULES (the one rules place), type guessing for old/AI-less tasks
- `src/lib/tasks.ts` — `type` on tasks, AI validation falls back to a title guess, MOCK routing sets types, per-type flow text
- `src/lib/store.ts` — old tasks normalized with a guessed type; next steps, photo and AI-check gating all read TASK_TYPE_RULES; done repairs can reopen to In progress with a note; `createCleaningTask`
- `src/app/api/guest/message/route.ts` — AI prompt now also returns `type` (with the request/cleaning/repair definitions)
- `src/app/api/tasks/[id]/route.ts` — new actions `finish` (staff Done for request/repair) and `reopen` (supervisor only, note needed); a staff Done from In progress is no longer treated as supervisor work, Done from review still is; friendly 409s for missing proof photo / missing AI check
- `src/app/api/tasks/[id]/ai-check/route.ts` — refused (409) for non-cleaning tasks
- `src/app/api/tasks/route.ts` — new POST: create "Clean room <number>" (supervisor/owner only)
- `src/lib/photo-check.ts` — issues are one short line ("Not found: bed, towels, pillow. Fix the room and take a new photo.")
- `src/app/staff/StaffBoard.tsx` — type badge on each card; next button, disabled state, hints, photo block ("Proof photo" for repairs) and AI block all follow the type rules
- `src/app/staff/page.tsx`, `src/app/r/[room]/GuestForm.tsx` — per-type wording; guest confirmation also shows the type
- `src/components/CleanRoomForm.tsx`, `src/components/DoneRepairs.tsx` — new: the cleaning form and the finished-repairs proof-photo list (with the supervisor Reopen form)
- `src/app/supervisor/page.tsx`, `src/app/owner/page.tsx` — New cleaning task form + Finished repairs section
- `docs/PROJECT_MAP.md` — T1 (ANT-39) before M6; M6 row/title now "cleaning tasks only" (Linear ANT-22 updated the same way, with a comment)
- `README.md` — task types, cleaning form, reopen and the new try-it steps
- `DEVLOG.md` — this entry

Linear:
- ANT-39 (T1) — created High as a sub-issue of ANT-5, taken by Meta1 ("Meta1: taking this"), In Progress, then Done with a summary comment.
- ANT-22 (M6) — title and description updated: cleaning tasks only; comment added. Left Todo for whoever takes it next.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok.
- API test (30/30 checks passed, LIVE AI, server on port 3100): "leak in the bathroom and bring two towels" → repair for Maintenance/Ruslan + request for Housekeeping/Aigerim. Towels: Accept → Start → Done with no photo (AI check on it refused, 409). Leak: finish without a photo refused (409 "Add a proof photo…"), photo uploaded, AI check refused (409, repair needs none), Done with the photo saved; staff reopen refused (403), supervisor reopen without a note refused (400), with a note → In progress with the note, finished again with the photo still on it. Cleaning: staff creating one refused (403); supervisor created "Clean room 777" and the owner "Clean room 778"; Aigerim Accept → Start, Send to review without photo refused (409), with photo but no AI check refused (409), AI check ran LIVE (score 67, one-line issue "Not found: towels. Fix the room and take a new photo."), Send to review worked, supervisor approved → Done. Guest "please clean my room" → a cleaning task. The 9 pre-existing saved tasks (no type in the file) read back with guessed types.
- Browser (port 3100, no console errors): Aigerim's board shows Request/Cleaning badges, a started request with a Done button and "No photo needed", and the done cleaning task with the one-line AI issue; Ruslan's board shows Repair badges, "Proof photo (0/3) / Add a proof photo to finish. No AI check needed." with Done disabled until a photo exists, and the finished repair keeping its proof photo; Supervisor home shows the New cleaning task form and the finished repair with its photo and Reopen form; Owner home shows the form and the same repair photos (no Reopen).
- Responsive: at a true 375px and 1440px width (measured in frames) the guest, staff and owner pages have no sideways scroll (`scrollWidth` = width).
- Test data cleaned up afterwards: the tasks/photos created by the tests were removed and the 9 pre-existing saved tasks restored untouched (`.data` is git-ignored).

NOT working / NOT checked yet:
- M6 (ANT-22, cleaning-only retake button + AI result polish) and M7 (the real supervisor review page) are still Todo — approving a cleaning task from a page is still done through the API, as before. The Reopen form above is only for finished repairs, as T1 asked.
- The AI type comes from the live model (or the MOCK word rules with no key); a wrong AI type is not corrected by a human anywhere yet.
- A real phone is not checked — layout was checked at 375px width in the browser as above.
- Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1). Triage tested LIVE with muse-spark-1.3, photo check LIVE with sam-3.1.
Linear: ANT-39, sub-issue of ANT-5 (M6 = ANT-22 updated, still Todo)

## Meta1 — 2026-10-31 — Demo sign-in and role screens (ANT-38 / D2)

What I built (simple words): There is now a sign-in page at `/login` in the v1.2 style. Six demo accounts — Owner, Supervisor, Aigerim (Housekeeping / cleaner), Ruslan (Maintenance), Daniyar (Front desk), Madina (Room service) — all with the demo password `demo1234`, shown on the login page; tap a person to sign in as them. Real sign-up comes later with the database (M2). After sign-in each person lands on their own screen in the v1.2 style: Aigerim gets "My rooms" (cleaner), Ruslan "Repairs", Daniyar "Front desk", Madina "Room service orders" — each sees only the tasks the AI sent to their department. The Supervisor and Owner get simple home pages with live task counts for now (their real pages are M7 and M10). Every signed-in screen has your name, role and a Sign out button. The guest page stays open without sign-in (QR link), and guests still create tasks without any account.

The server checks the role (not just the page): signing in is checked on the server and the browser only holds a random httpOnly cookie (sessions live in server memory, so a server restart signs everyone out — fine for a demo). Approve and Send back only work with a supervisor session — staff get HTTP 403 "Only a supervisor can approve or send back a task." The staff steps (Accept/Start/Send to review), photo upload and the AI photo check only work for the task's own team (wrong team = 403, signed out = 401). "Reset demo data" moved to the Owner home and the server refuses it for everyone else. The old "Who are you?" picker is gone: who you are is who you signed in as.

Links and demo accounts to try (dev server, http://localhost:3000):
- Guest, no login: `/r/204`
- Sign in: `/login` — owner, supervisor, aigerim, ruslan, daniyar, madina, password `demo1234` for all
- Owner home: `/owner` (sign in as owner) · Supervisor home: `/supervisor` (sign in as supervisor) · Staff screens: `/staff` (sign in as any staff account; the screen follows the account)

Files changed:
- `src/lib/users.ts` — new: the 6 demo accounts (username, name, role, department, landing screen) and the demo password constant, with a clear "demo only, real accounts in M2" note
- `src/lib/auth.ts` — new: server demo sessions (random token, httpOnly cookie, in-memory store), credential check, current-user helper
- `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/me/route.ts` — new: sign in / sign out / who-am-I (me returns `{user: null}` signed out so the login page checks quietly)
- `src/app/login/page.tsx` — new: v1.2-style sign-in (form + one-tap demo accounts + password shown + guest link + brand-950 aside)
- `src/components/SessionBar.tsx` — new: logo, avatar, name/role, Sign out on signed-in screens
- `src/app/staff/page.tsx` — sign-in guard (signed out → /login; owner/supervisor → their homes), per-role screen title
- `src/app/staff/StaffBoard.tsx` — board takes the signed-in user: picker and Reset link removed, department fixed by the account, v1.2 dark "Today" summary card added
- `src/app/supervisor/page.tsx` — new simple supervisor home (live counts; real review page is M7)
- `src/app/owner/page.tsx`, `src/app/owner/OwnerReset.tsx` — new simple owner home (live counts; Reset demo data here, Owner only)
- `src/app/api/tasks/[id]/route.ts` — server role check on PATCH (supervisor-only approve/send-back incl. the status forms; staff steps own-team only)
- `src/app/api/tasks/[id]/photos/route.ts`, `src/app/api/tasks/[id]/ai-check/route.ts` — signed-in own-team check
- `src/app/api/tasks/route.ts` — DELETE (Reset demo data) is Owner-only on the server
- `src/app/page.tsx` — home shows "Open my screen" when signed in, else the sign-in link
- `README.md` — accounts, links and server role rules written down
- `DEVLOG.md` — this entry

Linear:
- ANT-38 (D2) — taken by Meta1 ("Meta1: taking this"), In Progress, then Done with a summary comment. D1 (ANT-37) was finished and committed right before this in the same session.

How I checked it works:
- `npm run typecheck` ok, `npm run build` ok (new routes /login, /owner, /supervisor, /api/auth/* built).
- Page guards with curl: /staff and /owner signed out → 307 to /login; /owner as Aigerim → 307 to /staff; /staff as Supervisor → 307 to /supervisor; /staff as Aigerim and /owner as Owner → 200. Guest /r/204 and guest message API work with no sign-in (LIVE, created both tasks).
- Full role matrix with cookie jars (server on port 3100): wrong password → 401; signed-out PATCH → 401 "Please sign in to do this."; Aigerim accepting a Maintenance task → 403 wrong team; Aigerim Accept/Start on her own task → 200; Supervisor trying a staff step → 403; Supervisor uploading a photo → 403; Aigerim photo upload → 201; signed-out AI check → 401; Aigerim AI check → 200 LIVE score 100; Aigerim approve and send-back → 403 "Only a supervisor can approve or send back a task."; Supervisor send-back with note → 200 (note saved), Aigerim resubmits → 200, Supervisor approve → 200 Done. Reset as Supervisor and as Aigerim → 403 "Only the Owner can reset demo data."; Reset as Owner → 200 (cleared 9, run last on purpose). Logout → /api/auth/me shows signed out.
- Browser: /login shows all 6 demo accounts with the password; tapping Aigerim lands on /staff "My rooms" with "Hi, Aigerim" and housekeeping tasks only (no leak task); Ruslan lands on "Repairs" (only maintenance: leak + air conditioner, no towels task); Daniyar lands on "Front desk" (only the taxi task); Madina lands on "Room service orders" (correctly empty — no room-service tasks in the saved data); Owner lands on /owner with counts and Reset (Supervisor home has no Reset); Sign out returns to /login; no console errors after the /api/auth/me fix. Staff at a true 375px and 1440px width (frames): no sideways scroll. Screenshots: login, Owner/Supervisor homes and Ruslan's Repairs screen all in the v1.2 look.
- Test data handling, honest note: the API tests created tasks and the final Owner-reset test cleared the board (that is what Reset does). I restored the 7 pre-existing tasks from the backup taken before the tests. One pre-existing demo photo file (from an old Done test task) was deleted by that reset test; I recreated a simple placeholder PNG under the same file name so that task's photo link works again (200) — the original photo bytes are gone. Demo data only, but noting it here.

NOT working / NOT checked yet:
- Sessions live in server memory: restarting the server signs everyone out, and sessions do not survive. Real accounts, hashed passwords and sign-up come with the database (M2). The demo password `demo1234` is public on purpose — never use it for a real hotel.
- `GET /api/tasks` is still readable without sign-in (the guest confirmation and the boards read it; tasks hold no guest personal data). Locking reads down is a later hardening step, together with real accounts.
- Supervisor and Owner pages are simple homes (counts + text). Approving from a page is M7, the morning report is M10.
- Not pushed to GitHub (owner did not say "push").

AI model that helped: Muse via opencode (Meta1)
Linear: ANT-38, sub-issue of ANT-5

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
