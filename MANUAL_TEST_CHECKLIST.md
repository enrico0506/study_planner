# Manual Test Checklist

## Data safety (Settings → Data)
- Export: click “Export my data” → downloads `study-planner-backup_*.json` and adds a snapshot.
- Import (merge): choose the exported file → “Import data…” → confirm → app continues to work and data is present.
- Import (replace): choose the exported file → switch mode to “Replace” → confirm → app still loads (only keys in backup remain).
- Snapshot restore: click “Restore” on a snapshot → confirm → data rolls back.

## Keyboard + a11y
- Use Tab/Shift+Tab across pages: focus ring is visible on interactive elements.
- Icon-only buttons: verify screen readers get labels (e.g., menu “...” buttons).
- Reduced motion: set OS “reduce motion” → transitions/animations are minimized.

## Core flows
- Board: add/edit/delete subjects + files, reorder files, edit confidence.
- Timer: start/pause/resume session, reload page → session persists.
- Today focus: add tasks and subtasks, mark done.
- Calendar: add/edit/delete events.
- Timetable: add/edit/delete lesson; toggle weekend.
- Flashcards: add deck, add/delete cards; review still works.

## PWA (only on https/localhost)
- Load once online → go offline → reload → pages still open (from cache).

