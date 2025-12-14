# Study Planner

Lightweight study board with subjects/files, Pomodoro timer, today's focus list, and a daily schedule view.

## Features
- Subjects and files with confidence, notes, drag/drop ordering, and manual sort remembered even after switching sort modes.
- Focus session timer with study/breaks; sessions under 3 minutes are ignored. Today’s focus and subject cards stay in sync with the active session.
- Today's focus: drag files in, track subtasks, auto-complete logic (all subtasks done → main done). Completed tasks collapse; undone brings controls back.
- Daily schedule timeline: weekly columns of daily focus items, subject-colored, reorderable within subject, clickable to view subtasks, start study on today’s items, and active/done highlighting.
- Stundenplan page for weekly timetables: school-style table to add recurring lessons with custom names or link them to existing subjects so colors stay consistent, plus multiple timetables, duplication, cross-table lesson copy, and weekly overrides for cancellations/changes.
- Karteikarten page: create/import decks, study in a quick “I know it/Nochmal” loop or Anki-style spaced intervals with due counts per Stapel, KaTeX math rendering, and CSV import with auto/comma/semicolon/pipe/tab separators.
- Custom modals/toasts for input and notices (no browser alerts); “+” subject uses an in-app prompt.

## Run
- Open `index.html` directly in a browser (no build step; data in `localStorage`).
- Or serve locally to avoid any file:// quirks: `python -m http.server 8000` then visit http://localhost:8000/.
- Or run via Node/Express (same static files, plus health/db endpoints): `npm install` then `npm start` (defaults to port `10000`).

## Accounts (optional)
This repo includes a tiny email+password login and a per-user cloud sync of all `localStorage` keys that start with `study*`.

1) Set env vars:
- `DATABASE_URL` (Postgres connection string)
- `JWT_SECRET` (long random string)

2) Run the DB migration:
- `npm run migrate`

3) Start the server:
- `npm start`

## Structure
- `index.html` – app shell and modals.
- `src/main.js` – logic (state, timers, CRUD, schedule, today list).
- `src/styles/main.css` – layout/theme.
- `study-confidence-table.html` – legacy reference snapshot.
