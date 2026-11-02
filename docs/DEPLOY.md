# HotelApp LiveOps — Deploy plan (M1 / ANT-17)

Date: 2026-10-31. Owner is not a developer, so this plan uses the fewest
accounts and clicks we can. Nothing here needs a paid plan for the hackathon.

## The choice (simple words)

```text
Phone / computer browser
        |  HTTPS (automatic)
        v
Vercel  — the app itself (Next.js pages + /api routes), region iad1 (Washington)
        |
        +--> Supabase Postgres  — saved tasks (and later history)
        +--> Supabase Storage   — staff photos (bucket "task-photos", from M11; local .data/photos until then)
        |
        +--> Meta Model API     — AI, with MODEL_API_KEY (server only)
```

- **Vercel** runs the app. Plan: **Hobby (free)**. Function region: **iad1** (Washington, D.C.) — the closest Vercel region to the Supabase project, so app and database talk fast. (Changed from the earlier fra1 idea: the Supabase project "readybell" is in East US, North Virginia, so iad1 is the matching pair.)
- **Supabase** is the one service for both the database and photos.
  Project: **readybell**, region **East US (North Virginia)**. Plan: **Free**. Free limits checked on the pricing pages on 2026-10-31:
  500 MB database, 1 GB file storage — far more than this demo needs.
- **No new passwords if possible:** sign in to both Vercel and Supabase
  with the GitHub account that already owns this repo
  (`AntonNovozhilov-roof/hotelapp-liveops`). So the owner already has the
  only login that matters; Vercel and Supabase just ask "Continue with GitHub".
- **No bank card:** do not enter card details anywhere. If a page asks for
  a card for the free plan, stop and tell the agent (in Linear) — do not pay.
- **HTTPS:** automatic. Vercel gives an `https://….vercel.app` address with
  a valid certificate, no setup. This is also what lets a real phone use
  the microphone (guest voice) and camera (staff photos).

Why not the other options:

| Option | Why not (for us, now) |
|---|---|
| One small server (VPS, e.g. Hetzner/DigitalOcean) | One account, but many more steps: install updates, set up HTTPS by hand, backups, fix it if it stops. Owner is not a developer. |
| Vercel + Neon (DB) + separate photo storage (S3 etc.) | Three services instead of two. Supabase already gives database + photo storage in one place. |
| Render / Fly.io (app + database + disk in one service) | Looks like one service, but the free database/disk rules are worse for us (expiring free Postgres, paid persistent disk, apps sleeping). More surprises near demo day. |

Known free-tier catch (Supabase): a free Supabase project **pauses after
about 1 week with no use**, and then needs one click in the Supabase
dashboard to wake up. During building and demo rehearsal the app is used
often, so this should not happen. Rule before any demo: open the app link
the day before and send one test guest message. If it is slow or errors,
open Supabase and click **Restore project** if shown, then wait a few
minutes.

## Work order (changed again 2026-10-31 — owner: build the full app locally first)

```text
M3..M10 (photos, review, supervisor, history, owner report — all local,
on the Mac, with the local .data storage)
-> SEC1 (security fixes, ANT-57 — owner decision 2026-11-02: done today,
before M2)
-> M2 (ALL saved data into Supabase: tasks, history, reports, rooms + QR
tokens, hotel info, settings, perfect room references, and photos to
Storage) -> M11 (go online) -> M12 (full demo test)
```

**M2 and M11 stay Todo and start on Nov 3 morning at the latest.** Until
then nothing in the app needs Supabase or Vercel: tasks stay in
`.data/tasks.json` and photos in `.data/photos`, exactly as local dev works
today. When M2/M11 happen, only two things switch storage: the task store
(`src/lib/store.ts`, database when `DATABASE_URL` is set) and the one photo
helper file (`src/lib/photos.ts`, cloud storage instead of `.data/photos`).
Photo survival online is then proved in M11 and again in the M12 full-loop
test.

## Where things live

| Thing | Online (Vercel + Supabase) | On your Mac (local dev, unchanged) |
|---|---|---|
| App code | Vercel, built from the GitHub repo | This repo, `npm run dev` |
| Tasks | Supabase Postgres table `tasks` | `.data/tasks.json` if no `DATABASE_URL` is set (today's behaviour) |
| Photos (from M3) | Supabase Storage bucket `task-photos`; only the photo URL is saved on the task row | Local files in `.data/photos` (git-ignored), via the one helper file `src/lib/photos.ts` — so `npm run dev` works with no cloud keys at all. Only that helper file changes when photos move to the cloud in M11 |
| History (from M8) | Supabase Postgres table `history` | Same local fallback story as tasks |
| **ALL other saved data (SEC1, 2026-11-02)** | **M2 must move everything, not only tasks:** history, reports, rooms and QR tokens, hotel info, settings, perfect room references (records in Postgres; their photo files in Storage) — one table (or JSON column) per kind in Supabase Postgres, same API shapes | Local `.data/*.json` files, exactly as today, when no `DATABASE_URL` is set |
| Secrets | Vercel Environment Variables (typed in by the owner, see below) | `.env.local` (never committed, never pasted into chat/Linear) |

Rule for M2 so local dev keeps working: **if `DATABASE_URL` is not set,
the app uses the local `.data/tasks.json` file exactly as today.**
`npm run dev` on the Mac must keep working with only `MODEL_API_KEY`
in `.env.local`. Setting `DATABASE_URL` in `.env.local` is optional and
only for testing the real database from the Mac.

## Env vars (names only — never values in docs, chat, or Linear)

| Name | Needed from | Where it goes | Secret? |
|---|---|---|---|
| `MODEL_API_KEY` | Already used today | `.env.local` on the Mac; Vercel env settings online | Yes — server only |
| `DATABASE_URL` | M2 | `.env.local` (optional, local DB test); Vercel env settings | Yes — it contains the database password. Use the Supabase **Transaction pooler** URI (port **6543**). Server only, never `NEXT_PUBLIC_` |
| `SUPABASE_URL` | M2 (photos in Supabase Storage; without it photos stay local files) | Same places as above | No, but keep server-side anyway |
| `SUPABASE_SERVICE_ROLE_KEY` | M2 (photos in Supabase Storage) | Same places as above | Yes — server only, never in the browser, never `NEXT_PUBLIC_` |
| `SUPABASE_PHOTOS_BUCKET` | M2 | Same places; value is just `task-photos` (a PRIVATE bucket) | No |
| `SESSION_SECRET` | SEC1 (already in code) | `.env.local`; Vercel env settings | Yes — signs the 12h sign-in cookies. Long random value from a password manager. Always set online; empty only falls back to a marked development secret locally |
| `DEMO_MODE` | SEC1 | Same places; value `true` or `false` | No. `true` = public demo sandbox (demo accounts shown on /login, demo hotel auto-loads when empty, guest links work without QR token). Use `true` for the hackathon demo link |
| `ALLOW_DEMO_RESET` | SEC1 | Same places; value `true` or `false` | No. Default off. `true` shows + enables the Owner "Reset demo data" button. Keep `false` unless the link is a throwaway sandbox |
| `AI_DAILY_LIMIT` | SEC1 | Same places; a number, default 500 | No. Daily cap on real AI calls; over the cap the app answers with clearly marked MOCK and logs one line |
| `ALLOW_DB_RESET` | M11 (ANT-27) | Local database testing only — **never in Vercel** | No. When `DATABASE_URL` is set, `ALLOW_DEMO_RESET` is ignored and only `ALLOW_DB_RESET=true` opens the Owner reset. The Mac and the online app share one database, so a demo flag must never wipe it |
| `APP_URL` | M11 | Vercel (after the first deploy); optional in `.env.local` | No — it is the public link itself. QR codes and printed login cards use it, so they never point at localhost or a preview address |
| `CRON_SECRET` | M11 | Vercel; optional locally | Yes — protects `/api/cron/daily`. Vercel sends it by itself when it runs the daily job. Make it like `SESSION_SECRET`: long random, from a password manager |

That is the whole list. The M2 agent may only add a var by updating this
table, `.env.example`, and the issue comment — no silent new secrets.

**Security already in the app (SEC1 / ANT-57, before M2):** tasks, photos,
history and reports APIs require sign-in (staff see only their department;
guests only get the status+title of tasks from their own messages, proved by
a signed httpOnly guest cookie, and never photos); sign-in is a signed 12h
cookie (`SESSION_SECRET`) that survives restarts; guest hotel info is
guest-safe fields only and needs a valid room link; guest text is limited to
10/min and voice to 5/min per IP and per room (HTTP 429, friendly message);
mutating requests with a foreign `Origin` are rejected. `npm test` proves
these (401s, 403 cross-department, guest isolation, reset blocked, 429,
restart survival, foreign Origin).

## Part A — Owner: create the Supabase project (about 10 minutes; not needed until Nov 3 morning — M2/M11 start then)

Do this once. Have your password manager open (or pen and paper you keep).

1. Go to https://supabase.com and click **Start your project**.
2. Click **Sign in with GitHub** (use the GitHub account that owns this
   repo). If GitHub asks "Authorize Supabase?", click **Authorize**.
3. If asked to create an organization: name it `hotelapp`, pick the
   **Free** plan, click **Create organization**. (If you already have an
   organization, pick it.)
4. Click **New project**.
5. Name: `readybell`.
6. **Database password:** click **Generate a password**, then **copy it
   into your password manager right away** (name the entry
   "Supabase readybell database password"). You will need it when you
   copy DATABASE_URL (step M2 below) and nobody — including the agent —
   can recover it for you. Never paste it into chat or Linear.
7. **Region:** **East US (North Virginia)** — already chosen for the
   "readybell" project. It pairs with Vercel region **iad1**.
8. Click **Create new project** and wait 1–2 minutes until the dashboard
   finishes "Setting up project".
9. Stop here for now. Do **not** create tables or buckets yet:
   - the tables are created in M2 — run `supabase/schema.sql` from this
     repo in **SQL Editor → New query → Run** (it also creates the
     private `task-photos` bucket; see the M2 steps the agent gave you).
10. Tell the agent in Linear (on ANT-17 or ANT-18): "Supabase project
    created". Do not send the password or any key.

## Part A2 — Owner: turn on the database (M2 / ANT-18, about 10 minutes)

Do this once, on your own computer. Never paste any value into chat or Linear.

1. Open https://supabase.com, sign in, and open the **readybell** project.
2. In the left menu click **SQL Editor**, then **New query**.
3. In this repo, open the file `supabase/schema.sql`, copy ALL of it, paste it into the query box, and click **Run**. You should see a success message. (It creates the tables with Row Level Security ON and no public policies, plus the PRIVATE `task-photos` bucket. Running it again is safe.)
4. Check the bucket: left menu **Storage**. You should see `task-photos` marked **Private**. If it is not there, create it by hand: **New bucket**, name `task-photos`, leave **Public bucket** OFF, click **Create**.
5. Get the database connection string: top bar **Connect** → **Transaction pooler** (port **6543**) → copy the URI. If it contains `[YOUR-PASSWORD]`, replace that part (including the brackets) with your Supabase database password from your password manager.
6. In this repo on your Mac, open `.env.local` and set `DATABASE_URL=` to that URI (the line is already there in `.env.example`; add it to `.env.local` if missing).
7. Get the photo-storage values: left menu **Project Settings (gear) → API**. Copy **Project URL** into `SUPABASE_URL=` and the **service_role** key (labelled "service_role / secret" — NOT the anon/publishable key) into `SUPABASE_SERVICE_ROLE_KEY=` in `.env.local`. Make sure `SUPABASE_PHOTOS_BUCKET=task-photos` is there too.
8. Optional but recommended: copy your current local data up once — in the repo folder run `npm run db:import`. It copies `.data` (including photos) into Supabase. Running it twice is safe (no duplicates).
9. Restart `npm run dev` and use the app normally: everything now saves to the database. To prove it, restart the app — your tasks, rooms and photos are still there. (To go back to local files, empty `DATABASE_URL` again and restart.)
10. Tell the agent in Linear (ANT-18): "schema done". Do not send any key or password.

## Part B — Owner: create the Vercel project (about 15 minutes, M11 / ANT-27)

The code is ready: `vercel.json` in the repo already sets Framework =
Next.js, build = `npm run build`, start = Next.js default, function
region **iad1**, 60-second timeouts for the slow AI routes (photo check,
reports, guest message, voice), and one daily cron job. You only click
through Vercel and paste the values below.

0. First say **"push"** to the agent (agents never push without your word),
   wait until the agent confirms the newest code is on GitHub.
1. Go to https://vercel.com and click **Sign Up**, then
   **Continue with GitHub** (the GitHub account that owns
   `AntonNovozhilov-roof/hotelapp-liveops`). Authorize if asked.
   Pick the **Hobby (free)** plan if asked. No bank card — if a page
   asks for a card, stop and tell the agent in Linear.
2. On the Vercel dashboard click **Add New… → Project**.
3. In "Import Git Repository", find **`hotelapp-liveops`** and click
   **Import**. (If it is not listed, click **Adjust GitHub App
   Permissions** / "Install" and allow Vercel to see that repository,
   then come back.)
4. On "Configure Project": Framework Preset = **Next.js** (it reads
   `vercel.json` by itself), Root Directory = `./`, build settings
   untouched. Do not change the region here — `vercel.json` sets
   **iad1**. After the project exists you can check it under
   **Settings → Functions → Function Region** = Washington, D.C. (iad1).
5. Open **Environment Variables** and add each row of this table the same
   way: type the Name, paste the Value, Environment = **Production**
   (tick Preview too if shown — harmless), click **Add**. Values come
   only from your own Mac / password manager / Supabase — never from
   chat or Linear.

   | Name | Value — where it comes from (one line) |
   |---|---|
   | `MODEL_API_KEY` | Copy the text after `MODEL_API_KEY=` in `.env.local` on your Mac. |
   | `DATABASE_URL` | Supabase `readybell` → **Connect** → **Transaction pooler** URI (port **6543**, `pooler.supabase.com`); replace `[YOUR-PASSWORD]` with the database password from your password manager. |
   | `SUPABASE_URL` | Supabase `readybell` → **Project Settings (gear) → API** → **Project URL**. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same API page → the **service_role / secret** key (never the anon/publishable one). |
   | `SUPABASE_PHOTOS_BUCKET` | Type exactly: `task-photos` |
   | `SESSION_SECRET` | A NEW long random value (do not reuse the local one): on the Mac open Terminal in this repo folder and run `openssl rand -hex 32`, copy the 64 characters it prints — or generate 32+ random characters in your password manager. Save it in the password manager too. |
   | `DEMO_MODE` | Type exactly: `true` (public demo: demo accounts shown on /login, demo hotel auto-loads). |
   | `ALLOW_DEMO_RESET` | Type exactly: `false` (in database mode it is ignored anyway — see `ALLOW_DB_RESET`). |
   | `AI_DAILY_LIMIT` | Type exactly: `500` |
   | `CRON_SECRET` | A new long random value, made exactly like `SESSION_SECRET` above (a different one). |
   | `APP_URL` | Add this one AFTER the first deploy (step 7): the public `https://….vercel.app` address Vercel gives you, nothing after it. |

   Do **NOT** add `ALLOW_DB_RESET` in Vercel, ever. It is the only
   switch that could open "Reset demo data" against the shared online
   database, and it stays unset online on purpose.
6. Click **Deploy**. Wait until Vercel shows "Congratulations" with a
   picture of the site (about 1–2 minutes).
7. Click the big site link (or **Visit**). Your online address looks like
   `https://hotelapp-liveops-….vercel.app`. Now add the last variable:
   **Settings → Environment Variables → Add** `APP_URL` = that address,
   then **Deployments → ⋯ on the newest deployment → Redeploy** (env
   values only count after a redeploy). QR codes and login cards now
   point at this public address.
8. Copy the public link into the Linear issue ANT-27 (the link is not a
   secret) and tell the agent "deployed: <link>". The agent then runs
   the Part D smoke test against it.
9. From now on: every time the agent pushes new code to GitHub (only
   when you said "push"), Vercel rebuilds and updates that same link
   by itself in about a minute. Nothing to click.

Changing a secret later: Vercel dashboard → project `hotelapp-liveops` (the Vercel project name may differ from the Supabase project `readybell`) →
**Settings → Environment Variables** → edit the value → then
**Deployments → ⋯ on the newest deployment → Redeploy**.

### Timers on Vercel — what runs when (M11)

There is no always-on server online, so nothing runs "in the
background". All three timed jobs work the same way they do locally —
on page load — and the first two also get a daily backstop:

| Job | How it works online |
|---|---|
| Guest conversation retention cleanup (closed chat text deleted after the owner-set 1/7/30 days) | On read: every time conversations are loaded, expired closed chats are deleted (`pruneExpiredConversations`, same code as local). Plus the daily cron below. |
| Check-out-day cleaning tasks (after 11:00 on check-out day, exactly once) | On page load: the first staff/supervisor/owner/rooms page open creates them (`ensureAutoCheckoutTasks`, claim in the database, never twice — same as local). Plus the daily cron below. |
| Daily report | On page load, deliberately NOT on a timer: the first Reports page open after 07:00 makes it from the facts at that moment. No report is lost if nobody opens the page early — it is made when first needed. |
| Daily cron backstop (`vercel.json`, Hobby = one run per day) | Vercel calls `GET /api/cron/daily` at 12:00 UTC every day (protected by `CRON_SECRET`): it runs the retention cleanup and creates any due check-out cleaning tasks for days when nobody opened the app. Times are UTC on Vercel; the page-load rules above still fire first in normal use. |

## Part C — After the first deploy (M11 checks, on a real phone)

1. On your phone (Wi-Fi off is fine), open the online link, then add
   `/r/204` at the end. Send: "There is a leak in the bathroom and
   please bring towels". Tasks should appear (LIVE, or MOCK if no key).
2. Open the same link + `/staff` on the phone or computer, pick Ruslan,
   move the leak task Accept → Start → Done. The guest page status must
   follow by itself.
3. Ask the agent to redeploy (Vercel → Deployments → ⋯ → Redeploy).
   Refresh `/staff`: the tasks must still be there. That proves the
   database — not the app server — holds the tasks.
4. Also confirm these two M11 safety items (added 2026-10-31):
   - the **"Reset demo data" link is hidden online** (it stays available
     in local dev on the Mac). The online database must not be wipeable
     from a public page;
   - **guest sending is rate-limited**: sending guest messages or voice
     recordings many times in one minute must stop with a friendly
     "please wait a minute" message (HTTP 429). Suggested simple limits
     for M11: 10 text messages and 5 voice recordings per minute per
     visitor (per IP). A simple in-code counter is fine for the
     hackathon; the agent must say in the M11 comment that it is simple
     and can reset when the server restarts — it stops accidents and
     casual spam, it is not bank-grade protection.

## Part D — Agent smoke test on the public link (after the owner posts it)

Run by the agent against the real `https://….vercel.app` address, in
this order; results go on ANT-27. Synthetic data only.

1. Guest page: open `/r/204?t=<token from the Owner's QR page>` (and, in
   DEMO_MODE, plain `/r/204`) on the public link — page loads over
   HTTPS, MOCK banner state matches whether a key is set.
2. Guest message: send "There is a leak in the bathroom and please
   bring towels" — reply arrives, 2 tasks (Maintenance repair +
   Housekeeping request), guest sees only those two statuses.
3. Sign-in: `/login` as Owner (`owner` / `demo1234` in DEMO_MODE) —
   Owner home loads; sign out and in as Aigerim and Ruslan — each sees
   only their own team's tasks (403 cross-team at the API).
4. Staff board: Aigerim Accept → Start on the towels request → Done;
   the guest page status follows to Done by itself.
5. Photo upload: on a cleaning task (Clean room 204), Aigerim adds a
   photo from the test set — upload succeeds, photo opens for staff,
   signed-out photo URL is 401.
6. AI check: **Run AI photo check** finishes (LIVE or clearly MOCK),
   verdict is shown simply; Send to review / supervisor Approve flow
   works; task ends Done.
7. Reports: Owner opens `/reports` — daily report is made (after
   07:00 auto, or Regenerate), numbers checked line present.
8. QR link: Owner → Rooms → QR codes — decode/copy one room link; it
   starts with the `APP_URL` public address (not localhost, not a
   preview URL) and opens the right room's guest page. Login card on
   `/team` shows the same public address.
9. Safety: Owner home shows Reset demo data **turned off** (no working
   reset) even though it may be on locally; delete call is refused.
10. Survival: ask the owner to Redeploy once (Deployments → ⋯ →
    Redeploy), then repeat steps 3–4 quickly — tasks and the photo are
    still there.

## Local dev (must keep working — for every future task)

- `npm install`, `npm run dev`, http://localhost:3000 — unchanged.
- `.env.local` on the Mac keeps working with just `MODEL_API_KEY`.
  No `DATABASE_URL` locally = local `.data/tasks.json` file, as today.
- Any task that breaks plain `npm run dev` on the Mac (for example by
  demanding Supabase for every page) is not done, even if online works.

## Who does what, in order

| Step | Who | What |
|---|---|---|
| M3–M10 | Agent (all local, first) | Photos (local `.data/photos`), review flow, supervisor, history, owner report — no accounts, no deploy |
| A | Owner (by Nov 3 morning) | Part A above: Supabase project + save DB password in password manager |
| M2 | Agent (Nov 3 morning at the latest) | Move tasks to Supabase Postgres (same API shapes, local fallback kept); gives owner one SQL block to run in Supabase SQL Editor |
| — | Owner | Run that SQL block (Supabase → SQL Editor → New query → paste → Run), say "done" in Linear |
| M11 | Agent (right after M2) | Switch photos to cloud storage (only `src/lib/photos.ts`), small online-safety changes (hidden Reset online, guest rate limit), checks `npm run build`, says "ready to deploy" |
| B | Owner | Say "push", then Part B above (Vercel import + paste env vars + Deploy) |
| C | Owner + agent | Part C phone checks together; agent logs results in ANT-27 |
| M12 | Agent + owner | Final full-loop test on the public link (demo script in README) |

## Safety rules (unchanged from AGENTS.md)

- Keys and passwords only in `.env.local` (Mac) and Vercel env settings
  (online). Never in code, git, chat, Linear, or this file.
- Fake hotel data only. No real guest names, phones, or documents.
- Agents do not push to GitHub until the owner says "push".
