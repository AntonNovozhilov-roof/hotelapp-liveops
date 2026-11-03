# Run Readybell on your computer

Back to the main README: [README.md](../README.md) · Live demo: https://readybell.vercel.app

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

**Sign-in secret (`SESSION_SECRET`, SEC1):** sign-ins are signed cookies
(HMAC with `SESSION_SECRET`, 12 hours, httpOnly), not a list on the server,
so **you stay signed in when the app restarts**. Put a long random value in
`.env.local` (and later in Vercel env settings), for example 32+ random
characters from a password manager. If it is empty, local testing still
works with a clearly marked development fallback — always set a real value
online. Demo behaviour is controlled by `DEMO_MODE=true` (demo accounts
shown on /login, demo hotel auto-loads, room links without QR token) and
`ALLOW_DEMO_RESET=true` (Owner reset button in file mode only; default
off). When `DATABASE_URL` is set — the Mac and the online app then share
one database — `ALLOW_DEMO_RESET` is ignored and only
`ALLOW_DB_RESET=true` could open reset; never set that online.
`AI_DAILY_LIMIT` caps real AI calls per day (default 500; then marked
MOCK answers). Online (Vercel, region iad1 via `vercel.json`), `APP_URL`
is the public address QR codes and login cards print, and `CRON_SECRET`
protects the one daily cron backstop (retention cleanup + check-out
cleaning tasks; both also run on page load, and the daily report is made
on the first Reports open after 07:00). To wipe test data online there is
a hidden page `/admin/restore` (not linked anywhere): it needs the
`RESTORE_SECRET` code — checked only on the server, 5 tries per
10 minutes, a sign-in alone is never enough — plus typing `RESTORE`,
then it deletes all hotel data and loads a fresh rich demo hotel (demo
accounts unchanged). The click-by-click deploy guide
is `docs/DEPLOY.md` Part B.

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
- **Sign-in survives an app restart** (SEC1): sign-in is a signed cookie
  that lasts 12 hours. It only ends early if you sign out or the cookie
  expires.
- Demo accounts and the `demo1234` password are for local testing only.
- The microphone needs HTTPS or `localhost` (see above), and voice
  transcription also needs a real `MODEL_API_KEY`.
- This is a local test build, not the online version: do not put real
  guest names, phones, passports or payments into it.

## Team, rooms and bookings (E1 + R2)

- **Team (`/team`)**: Owner or Supervisor adds employees (name, role, login like `anna.k`). The app makes a strong password and shows it **once** with a printable login card — it cannot be shown again. Reset password, edit, deactivate (signs them out, history kept) and reactivate there. Passwords are scrypt hashes. Everyone changes their own password from the menu under their name (top right). Demo accounts work only with `DEMO_MODE=true`.
- **Rooms (`/owner/rooms`)**: tabs **Rooms & prices** (types, prices, today's Free/Occupied/Arriving/Leaving status, bulk edit), **Bookings** (14-day calendar on desktop, per-day list on phone; overlap is blocked; “Checked out” makes a cleaning task once — and it also appears automatically after 11:00 on check-out day) and **QR codes**. Currency is set in **Hotel info** (default USD). Reports include occupancy and room revenue, and sample-week loading also creates sample bookings.

## Checks

```bash
npm run typecheck
npm run build
```

## Demo photos

Small room photos in `public/demo` let judges try the AI photo check without
their own photos. All are from Wikimedia Commons:

- `room-perfect-bed.jpg`, `sample-matching.jpg` — "Bed in hotel room 3", CC0
- `room-perfect-bathroom.jpg`, `repair-proof.jpg` — "Phoenix bathroom Residence Inn Marriott hotel with towels and shower", CC0
- `sample-towels-missing.jpg` — crop of the bathroom photo above, CC0
- `sample-bed-not-made.jpg` — "Unmade bed seen from desk, Comfort Inn, Waynesboro, Virginia", CC BY-SA 4.0

Their AI results were checked once and saved in the repo
(`src/lib/demo-ai-data.json`, `src/lib/demo-photo-cache.json`), so loading
the demo hotel again needs no AI calls.
