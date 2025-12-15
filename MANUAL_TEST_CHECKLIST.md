# Manual Test Checklist

## Navigation + accessibility
- Tab through the page: visible focus ring on links/buttons/inputs.
- Use the “Skip to content” link: jumps to `#spMain`.
- Topbar: active page is highlighted; Search/Data modals open and close with `Esc`.

## Data safety (Import/Export)
- Open Data modal → Export: a `study-planner-backup_*.json` downloads.
- After export: Data modal shows an auto snapshot (“Auto: export”).
- Import: choose the exported file → confirm → data is restored (no console errors).
- Restore snapshot: click “Restore” on a snapshot → confirm → state rolls back.

## Dashboard (index.html)
- Create subject + add file, edit names, adjust confidence.
- Drag a file to reorder.
- Start/stop focus timer; refresh page; timer state is preserved.
- Today focus list: add item, add subtasks, mark done.
- Switch between Board / Daily schedule views.

## Calendar
- Add an item on a date; edit it; delete it.
- Upcoming list updates; “No items” empty states appear when appropriate.

## Timetable
- Create timetable tab; add lesson; edit lesson; delete lesson.
- Toggle weekend; phone day navigation buttons work (narrow width).

## Flashcards
- Create a deck; add a card; delete a card.
- Switch modes (Normal/Interval); review queue works.
- CSV import opens; importing cards updates deck stats.

## Offline (PWA – only on https/localhost)
- Load site once online.
- Go offline → reload page: app shell loads from cache.
- Update `sw.js` cache version → reload: old cache is cleared.

