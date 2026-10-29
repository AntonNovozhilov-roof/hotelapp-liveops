# Dev Log

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
