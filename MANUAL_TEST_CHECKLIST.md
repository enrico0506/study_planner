# Manual Test Checklist

## Data safety (Settings → Data)
- Export: click “Export my data” → downloads `study-planner-backup_*.json` and adds a snapshot.
- Import (merge): choose the exported file → “Import data…” → confirm → app continues to work and data is present.
- Import (replace): choose the exported file → switch mode to “Replace” → confirm → app still loads (only keys in backup remain).
- Snapshot restore: click “Restore” on a snapshot → confirm → data rolls back.

## Keyboard + a11y
- Use Tab/Shift+Tab across pages: focus ring is visible on interactive elements.
- Icon-only buttons: verify screen readers get labels (e.g., menu “...” buttons).
- Dashboard (Subjects): tab to file row actions → focus ring visible on icon buttons (Add to Today / Move up / Move down).
- Dashboard (Today): tab to reorder buttons → focus ring visible; aria-live announces add/move/remove (NVDA/VoiceOver optional).
- Reduced motion: set OS “reduce motion” → transitions/animations are minimized.

## Core flows
- Board: add/edit/delete subjects + files, reorder files, edit confidence.
- Reorder file (no drag): use Move up/down buttons; also `Alt+ArrowUp/Alt+ArrowDown` while a file action button is focused.
- Add to Today (no drag): click “+” on a file → item appears in Today; duplicate shows toast “Already in Today's focus” and highlights item.
- Reorder Today (no drag): use ↑/↓ buttons; also `Alt+ArrowUp/Alt+ArrowDown` while focused inside the item.
- Remove from Today (keyboard): focus inside a Today item → press `Delete` → confirm → item removed.
- Timer: start/pause/resume session, reload page → session persists.
- Today focus: add tasks and subtasks, mark done.
- Calendar: add/edit/delete events.
- Timetable: add/edit/delete lesson; toggle weekend.
- Flashcards: add deck, add/delete cards; review still works.

## PWA (only on https/localhost)
- Load once online → go offline → reload → pages still open (from cache).
