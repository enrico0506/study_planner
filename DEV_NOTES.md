# Dev Notes

## Structure (front-end)

- `index.html` + `src/index/index.part*.js` – main app (board, today focus, timer, settings).
- `calendar.html` + `src/calendar.js` – calendar.
- `stundenplan.html` + `src/stundenplan.js` – timetable.
- `account.html` + `src/account.js` – optional accounts/sync (requires backend; doesn’t work on `file://`).

## Central storage + schema

`src/storage.js` provides `window.StudyPlanner.Storage`:
- Debounced writes (`setRaw`, `setJSON`) to reduce frequent `localStorage` churn.
- Backup export/import helpers (JSON file wrapper with `schemaVersion`).
- Local snapshot rotation (`studyLocalSnapshots_v1`, keeps last 12).
- Migration hook: `registerMigration(fromVersion, fn)` (currently schema is `1`).

Import behavior:
- Validates file format before touching storage.
- Requires explicit confirmation.
- Always creates an automatic “pre-import” snapshot.
- Supports `merge` (default) or `replace` modes.

## Data safety UI location

The Import/Export/Snapshots UI is implemented inside the existing Settings modal:
- `index.html` → Settings → Data tab
- `src/data-tools.js` wires the buttons and renders snapshots.

## PWA (optional)

- `manifest.webmanifest` + `public/icons/app-icon.svg`
- `sw.js` caches static assets.
- `src/pwa.js` registers the service worker only on `https:` or `localhost`.
