# Study Planner – Dev Notes

This project is a plain HTML/CSS/JS website (no bundlers, no framework). All user data is stored locally in `localStorage` (and optionally synced via `server.js` when running the Node backend).

## Project structure (front-end)

- `index.html` – main dashboard (subjects/files, today focus, timer, schedule, settings).
- `calendar.html` – calendar & deadlines.
- `stundenplan.html` – timetable.
- `karteikarten.html` – flashcards (KaTeX via CDN).
- `account.html` – optional account/sync UI (requires Node backend, not `file://`).

**Shared front-end modules (no ES modules; classic scripts)**

- `src/sp/namespace.js` – global namespace (`window.StudyPlanner`) + config.
- `src/sp/dom.js` – small DOM helpers + `escapeHtml`.
- `src/sp/a11y.js` – focus trap + reduced-motion helper.
- `src/sp/storage.js` – centralized localStorage wrapper, schema versioning, snapshots, import/export helpers.
- `src/sp/modals.js` – Data safety modal (import/export/snapshots) + Search modal.
- `src/sp/topbar.js` – shared nav header (active page indicator + Search/Data buttons).
- `src/sp/pwa.js` – safe service worker registration (only https/localhost).
- `src/sp/init.js` – mounts shared UI + registers SW.

**Index page code split**

The legacy `src/main.js` dashboard script was split into:
- `src/index/index.part1.js`
- `src/index/index.part2.js`
- `src/index/index.part3.js`
- `src/index/index.part4.js`

They load in order from `index.html` and share the classic-script global scope.

## Storage schema + migrations

The website primarily uses `localStorage` keys prefixed with `study*` (e.g. `studySubjects_v1`, `studyFlashcards_v1`, `studyCalendarEvents_v1`, etc).

`src/sp/storage.js` defines an **app-level** schema version (`StudyPlanner.Storage.SCHEMA_VERSION`). Imports/exports use a JSON wrapper:

```json
{
  "app": "StudyPlanner",
  "schemaVersion": 1,
  "exportedAt": "2025-01-01T12:00:00.000Z",
  "data": { "studySubjects_v1": "...", "studyFlashcards_v1": "...", "...": "..." }
}
```

Import flow:
- Validates the file shape (`data` is an object of `string|null` values).
- Creates an automatic **pre-import snapshot** (`studyPlannerSnapshots_v1`).
- Applies the keys in either `merge` mode (default) or `replace` mode (deletes missing study keys).
- Dispatches `study:state-replaced` so open pages can refresh.

Snapshots:
- Stored under `studyPlannerSnapshots_v1` (keeps the last 12).
- Created automatically on export and before import/restore.

## Running locally

**Static mode (no backend)**
- Open `index.html` directly in your browser. All core features work with `localStorage`.

**Backend mode (optional accounts/sync)**
- Install deps: `npm install`
- Start server: `npm start`
- Open: `http://localhost:10000/index.html` (or `.../account.html`)

## PWA / offline

- `manifest.webmanifest` defines the app manifest.
- `sw.js` caches static assets with a versioned cache and cleans old caches on activate.
- Service worker registration is skipped automatically on `file://` and non-localhost `http://`.

