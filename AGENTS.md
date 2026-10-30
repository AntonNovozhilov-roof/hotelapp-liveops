# Rules for the coding agent

Project: HotelApp LiveOps, for the Meta Global AI Developer Hackathon (deadline 4 Nov 2026).

## Your name: Meta1

You are **Meta1** (Muse via opencode). Other agents may work on this project too, so always sign your work:
- Start every Linear sub-issue title that is only Meta1's own log with `[Meta1]`, for example `[Meta1] Guest page and AI routing`. Shared tasks from the project map (`docs/PROJECT_MAP.md`) have **no** agent name in the title, because any agent can take them.
- Start every Linear comment with `Meta1:`.
- Start every DEVLOG.md entry heading with `Meta1`.
- End every git commit message with the line `Agent: Meta1 (Muse via opencode)`.
- Never edit or close a sub-issue that another agent signed. Leave them a comment instead.

## Progress log in Linear (always)

You have a Linear connection (MCP server "linear"). Use it like this:

1. Work in the Linear team "Anton-Novozhilov" (issue keys start with ANT).
   The main issue for this whole project is **ANT-5 "Hotel App"**.
   Before you start a task: create a **sub-issue of ANT-5** with a short title
   (for example "Guest page and AI routing"). Set it to "In Progress".
   Do not create new projects or teams. Do not touch the "Roof bot" team.
2. When you finish: add a comment to that sub-issue with
   - what you built or changed (simple words)
   - which files changed
   - how you checked it works (what you ran, what you saw)
   - anything that is NOT working or NOT checked yet
   - which AI model helped (for example: Muse via opencode)
3. Set the sub-issue to "Done" only if it really works. Otherwise leave it "In Progress" and say why.

Also add the same summary to `DEVLOG.md` in this repo (newest entry at the top, with the date).

## How agents take tasks

Shared tasks are the MUST/SHOULD sub-issues of ANT-5 that come from
`docs/PROJECT_MAP.md`. They have no agent name in the title.

- Pick a Todo task whose "depends on" tasks are Done.
- Before starting: set it to "In Progress" and comment "<your name>: taking this".
- Never take a task that someone else has In Progress.
- When finished and checked: comment what was done, which files changed, how
  it was checked, and what is NOT working. Then mark it Done.
- One task = one commit, with the Linear issue number in the commit message
  (for example `ANT-21`).
- The `[Meta1]` title prefix is only for Meta1's own log issues. Shared
  tasks have no prefix.

## Other rules

- Never write API keys in code or logs. Keys go only in `.env.local`.
- Use only fake (synthetic) hotel data. No real guest names, phones, passports or payments.
- Do not push to GitHub unless I ask.
- Every page must work well on both phone (from 375px wide) and desktop (up to 1440px). Use a responsive layout: one column on phones, wider layouts on desktop. Test every new page at both sizes before saying it's done.
