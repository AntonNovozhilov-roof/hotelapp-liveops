# HotelApp LiveOps — Deploy plan (M1 / ANT-17)

Date: 2026-10-31. Owner is not a developer, so this plan uses the fewest
accounts and clicks we can. Nothing here needs a paid plan for the hackathon.

## The choice (simple words)

```text
Phone / computer browser
        |  HTTPS (automatic)
        v
Vercel  — the app itself (Next.js pages + /api routes)
        |
        +--> Supabase Postgres  — saved tasks (and later history)
        +--> Supabase Storage   — staff photos (bucket "task-photos", from M11; local .data/photos until then)
        |
        +--> Meta Model API     — AI, with MODEL_API_KEY (server only)
```

- **Vercel** runs the app. Plan: **Hobby (free)**.
- **Supabase** is the one service for both the database and photos.
  Plan: **Free**. Free limits checked on the pricing pages on 2026-10-31:
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
-> M2 (tasks into Supabase Postgres) -> M11 (go online) -> M12 (full demo test)
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
| `DATABASE_URL` | M2 | `.env.local` (optional, local DB test); Vercel env settings | Yes — it contains the database password. Server only, never `NEXT_PUBLIC_` |
| `SUPABASE_URL` | M11 (photos online; local M3 photos need no keys) | Same places as above | No, but keep server-side anyway |
| `SUPABASE_SERVICE_ROLE_KEY` | M11 (photos online) | Same places as above | Yes — server only, never in the browser, never `NEXT_PUBLIC_` |
| `SUPABASE_PHOTOS_BUCKET` | M11 (photos online) | Same places; value is just `task-photos` | No |

That is the whole list. The M2 agent may only add a var by updating this
table, `.env.example`, and the issue comment — no silent new secrets.

## Part A — Owner: create the Supabase project (about 10 minutes; not needed until Nov 3 morning — M2/M11 start then)

Do this once. Have your password manager open (or pen and paper you keep).

1. Go to https://supabase.com and click **Start your project**.
2. Click **Sign in with GitHub** (use the GitHub account that owns this
   repo). If GitHub asks "Authorize Supabase?", click **Authorize**.
3. If asked to create an organization: name it `hotelapp`, pick the
   **Free** plan, click **Create organization**. (If you already have an
   organization, pick it.)
4. Click **New project**.
5. Name: `hotelapp-liveops`.
6. **Database password:** click **Generate a password**, then **copy it
   into your password manager right away** (name the entry
   "Supabase hotelapp-liveops database password"). You will need it in
   step B6 and nobody — including the agent — can recover it for you.
   Never paste it into chat or Linear.
7. **Region:** pick the region closest to the hotel (the list shows city
   names; if unsure, pick **Singapore** — it can be changed later only by
   making a new project, so closest-city is the rule).
8. Click **Create new project** and wait 1–2 minutes until the dashboard
   finishes "Setting up project".
9. Stop here for now. Do **not** create tables or buckets yet:
   - the `tasks` table is created in M2 — the agent will give you one
     exact block of text to paste into **SQL Editor → New query → Run**;
   - the `task-photos` bucket is created at M11 the same click-by-click way.
10. Tell the agent in Linear (on ANT-17 or ANT-18): "Supabase project
    created". Do not send the password or any key.

## Part B — Owner: create the Vercel project (about 10 minutes, at M11 time)

The agent will tell you when M2 is done and the code is ready. Do not
deploy before that message — today's code saves tasks to a local file,
which does not survive on Vercel.

0. First say **"push"** to the agent (agents never push without your word),
   wait until the agent confirms the newest code is on GitHub.
1. Go to https://vercel.com and click **Sign Up**, then
   **Continue with GitHub** (same GitHub account). Authorize if asked.
   Pick the **Hobby (free)** plan if asked.
2. On the Vercel dashboard click **Add New… → Project**.
3. In "Import Git Repository", find **`hotelapp-liveops`** and click
   **Import**. (If it is not listed, click **Adjust GitHub App
   Permissions** / "Install" and allow Vercel to see that repository,
   then come back.)
4. On "Configure Project": leave Framework Preset = **Next.js**,
   Root Directory = `./`, and the build settings untouched.
5. Click open **Environment Variables** and add the first variable:
   - Name: `MODEL_API_KEY`
   - Value: open `.env.local` **on your own Mac** (in this repo folder),
     copy the text after `MODEL_API_KEY=` on that line, and paste it
     into Vercel. Never paste it into chat or Linear.
   - Environment: **Production** (tick Preview too if shown — harmless).
   - Click **Add**.
6. Add the second variable the same way:
   - Name: `DATABASE_URL`
   - Value: in Supabase go to your `hotelapp-liveops` project, click
     **Connect** (top bar) — or **Project Settings (gear) → Database →
     Connection string**. Choose the **pooler / Session pooler** URI
     (the one whose address contains `pooler.supabase.com`; server apps
     on Vercel must use the pooler, not the direct connection). Copy the
     URI. If it contains `[YOUR-PASSWORD]`, replace that part (including
     the brackets) with the database password from your password manager.
     Paste the finished URI into Vercel as the value. Never into chat.
   - Click **Add**.
7. (Only when the agent says photos are moving online, at M11) add `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_PHOTOS_BUCKET` the same way.
   In Supabase, `SUPABASE_URL` and the service role key are under
   **Project Settings (gear) → API**. The service role key is the one
   labelled **service_role / secret** — not the `anon` / publishable key.
8. Click **Deploy**. Wait until Vercel shows "Congratulations" with a
   picture of the site.
9. Click the big site link (or **Visit**). Your online address looks like
   `https://hotelapp-liveops-….vercel.app`. Copy that link into the
   Linear issue ANT-27 (the link is not a secret).
10. From now on: every time the agent pushes new code to GitHub (only
    when you said "push"), Vercel rebuilds and updates that same link
    by itself in about a minute. Nothing to click.

Changing a secret later: Vercel dashboard → project `hotelapp-liveops` →
**Settings → Environment Variables** → edit the value → then
**Deployments → ⋯ on the newest deployment → Redeploy**.

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
