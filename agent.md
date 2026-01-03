# Agent Guide (how to instruct me)

Use this file as a shared “contract” so you can give short, precise commands and I can act without guessing.

## How to reference UI parts (main page)

On `index.html` I added stable markers like `data-section="..."`. When you tell me what to change, include the `data-section` name.

Common sections:
- `header-bar` (top header row: title + controls)
- `view-toggle` (Board / Daily schedule)
- `study-hubs-dropdown` (Study hubs links)
- `confidence-toggle` (Your confidence / Calculated)
- `header-menu` (Login / Settings / Suggestions / Study stats)
- `settings-modal` (settings dialog)
- `planner-header` (daily stats + focus session area)
- `daily-stats` (upper-left stats card)
- `focus-session` (upper-right focus session / timer card)
- `subjects-table` (Subjects table area)
- `today-sidebar` (Today’s focus sidebar)
- `schedule-view` (Daily focus timeline)
- `phone-bottom-nav` (mobile bottom navigation)

You can also ask: “List all `data-section` values on the main page”.

## Instruction template (copy/paste)

When you want a change, send something like:

1) **Where**
- Page: `index.html` (or `calendar.html`, `account.html`, `offline.html`, …)
- Section: `data-section=...` (or an element id like `#subjectTable`)

2) **What**
- Change: (text/style/layout/behavior)
- Constraints: (don’t change X, keep mobile behavior, keep wording, etc.)

3) **Done means**
- Acceptance criteria: (bullet list)

Optional but helpful:
- Device size: e.g. “phone 390×844” / “desktop 1440×900”
- Screenshot: highlight the area
- Language: “English” / “Deutsch”

## Project map (quick orientation)

- Main UI: `index.html`
- Other pages: `calendar.html`, `stundenplan.html`, `account.html`, `offline.html`
- Frontend JS entrypoints on main page: `src/index/index.part1.js` … `src/index/index.part4.js`
- Shared JS modules: `src/` (e.g. `src/storage.js`, `src/notes.js`, `src/insights.js`, …)
- Styles: `src/styles/` (main + responsive + phone-specific files)
- Server: `server.js`

## Run commands (if you want me to verify locally)

- Start server: `npm start`
- Run migration: `npm run migrate`

## Communication shortcuts (examples)

- “In `data-section=subjects-table`, make the header sticky on scroll (desktop + phone).”
- “In `data-section=planner-header`, reduce vertical spacing by ~20%.”
- “In `data-section=settings-modal`, add a new toggle under Preferences called ‘…’.”
