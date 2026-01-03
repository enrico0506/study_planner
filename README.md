# Study Planner

Lightweight study board with subjects/files, Pomodoro timer, today's focus list, and a daily schedule view.

## Features
- Subjects and files with confidence, notes, drag/drop ordering, and manual sort remembered even after switching sort modes.
- Focus session timer with study/breaks; sessions under 3 minutes are ignored. Today’s focus and subject cards stay in sync with the active session.
- Today's focus: drag files in, track subtasks, auto-complete logic (all subtasks done → main done). Completed tasks collapse; undone brings controls back.
- Daily schedule timeline: weekly columns of daily focus items, subject-colored, reorderable within subject, clickable to view subtasks, start study on today’s items, and active/done highlighting.
- Custom modals/toasts for input and notices (no browser alerts); “+” subject uses an in-app prompt.

## Run
- Open `index.html` directly in a browser (no build step; data in `localStorage`).
- For PWA testing / installability, use Node/Express (serves `/manifest.webmanifest`, `/sw.js`, `/icons/*` correctly): `npm install` then `npm start` (defaults to port `10000`).
- Optional: (re)generate PWA icons: `npm run gen:icons` (also runs automatically on `npm install`).

## PWA (Installable App)
Installability requirements are met when served on HTTPS (production) or on `localhost` (local dev).

### Verify installability
- Open Chrome/Edge → DevTools → **Application**
  - **Manifest**: name + icons (192 & 512) should be detected
  - **Service Workers**: `sw.js` should be active, with a fetch handler
- Run Lighthouse (PWA/installability checks): DevTools → **Lighthouse**
- Offline test: DevTools → **Network** → set **Offline**, then reload → app shell or `offline.html` should load (no browser error page)

### Install (Desktop)
- Windows: Chrome/Edge → click the **Install** icon in the address bar (or menu → “Install Study Planner…”)
- Linux: Chrome/Chromium/Edge → click the **Install** icon in the address bar (or menu → “Install Study Planner…”)

## Accounts (optional)
This repo includes a tiny email+password login and a per-user cloud sync of all `localStorage` keys that start with `study*`.
It also stores the last 20 synced snapshots as backups and includes an `account.html` page to restore them.

1) Set env vars:
- `DATABASE_URL` (Postgres connection string)
- `JWT_SECRET` (long random string)
- Optional: `AUTH_SESSION_DAYS` (how long the login cookie lasts; default `90`)

2) Run the DB migration:
- `npm run migrate`

3) Start the server:
- `npm start`

## Structure
- `index.html` – app shell and modals.
- `src/index/index.part*.js` – dashboard logic split into smaller files (state, timers, CRUD, schedule, today list).
- `src/storage.js` – centralized localStorage + snapshots + import/export helpers.
- `src/styles/main.css` – layout/theme.
