# hotelapp-liveops

AI operations layer for hotels: guest voice messages and staff photos become routed, verified tasks. And More. Meta AI Hackathon 2026.

## What works today

- `/r/204` — guest page for room 204: write a request, press Send.
- `POST /api/guest/message` — turns the guest text into tasks:
  department (`maintenance` / `housekeeping` / `front_desk` / `room_service`),
  title, priority (`high` / `medium` / `low`), confidence (0 to 1).
  One message can create 2 tasks, e.g. "leak in the bathroom and bring towels".
- With no API key, the app uses a fake MOCK answer and shows the word **MOCK**.

## How to run it

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open in your browser:

- http://localhost:3000/r/204

Try this text:

> There is a leak in the bathroom and please bring towels

## Using the real AI (optional)

1. Copy `.env.example` to `.env.local`.
2. Put your key in `.env.local`:

```text
MODEL_API_KEY=your_key_here
```

3. Restart `npm run dev`.

The server calls the Meta Model API (`https://api.meta.ai/v1`, model
`muse-spark-1.3`). The key is read only on the server from `.env.local`.
Never put the key in code and never commit `.env.local`.

Without a key, the page still works in MOCK mode.

## Checks

```bash
npm run typecheck
npm run build
```
