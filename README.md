# Advanced Features Added

Web App now includes:
1. Authentication (local placeholder + Google Sign-In placeholder button)
2. Welcome overlay + shimmering intro effect
3. Onboarding tour with spotlight focus (skippable, persisted)
4. Rich task model: title, due date, tags, recurrence (daily/weekly/monthly), description (collapsible), relations (link to other task IDs)
5. Task linking: relation chips clickable to jump & highlight
6. Import/Export v3 schema (tasks + settings + user)
7. Effects: card entrance animation, hover elevate, pulse highlight, shimmer on first login
8. Profile avatar with dropdown (logout, future actions)
9. Notification reminders (overdue)
10. PWA (offline caching via service worker + manifest)
11. Undo / Redo stack (Ctrl+Z / Ctrl+Y)

Task Schema v3 (web):
```
{
	id: number,
	title: string,
	createdAt: number,
	createdLabel: string,
	dueDate: string|"",
	isDone: boolean,
	tags: string[],
	recurrence: 'none'|'daily'|'weekly'|'monthly',
	description: string,
	relations: number[]
}
```

Export File v3:
```
{
	version: 3,
	exportedAt: ISOString,
	tasks: Task[],
	settings: {...},
	user: { name:string, email:string } | null
}
```

Google Sign-In Placeholder:
- To enable real OAuth: include Google Identity script, create OAuth client, on success set currentUser then save & start tour.

Security Notes:
- localStorage only, not secure for sensitive data or multi-user.
- No backend validation; all logic executes client-side.
- Relations are soft links (no referential integrity guarantee).
- Export file is plain JSON; treat as sensitive if it contains personal info.

Accessibility:
- Focus rings, ARIA-friendly updates, keyboard inline edit.
- Spotlight tour avoids trapping pointer events on underlying content.

Desktop (Qt/QML) Adaptation Progress:
- Added description & relations roles to `TaskListModel` (read-only editing draft in delegate).
- Next (not yet implemented): persistence (JSON load/save), profile/auth placeholder, tour overlay imitation using a semi-transparent layer + focus rectangle.

Planned Enhancements:
- Task map visualization (graph of relations)
- Better responsive positioning for tour tips (avoid offscreen)
- Bulk relation management UI
- Rich notifications scheduling

Limitations:
- No concurrency/conflict handling.
- Notifications rely on browser permission; no scheduling when app closed.
- Recurring tasks duplicate rather than update in place.

# Enhanced Todo List (Offline PWA)

Feature-rich, fast, and privacy-friendly todo app built with only vanilla HTML/CSS/JS.

## ✅ Features
- Add tasks with: title, optional due date, optional tags
- Tags: click a tag to filter, clear tag filter easily
- Inline editing (double click or edit button)
- Search + filter (All / Open / Completed / Overdue)
- Sorting: Newest, Oldest, A→Z, Z→A, Due Soonest, Due Latest
- Progress bar + stats (total, done, overdue, percent)
- Overdue highlighting + Today badge
- Recurring tasks (Daily / Weekly / Monthly) auto-generate next occurrence when completed
- Drag & drop reordering (order persisted)
- Bulk actions: Mark all done, Clear done
- Import / Export JSON backup
- Dark / Light theme toggle (stored in localStorage)
- PWA: Installable & offline (service worker + manifest)
- Notification (optional) to remind of overdue tasks
- Accessible: keyboard nav, aria-live updates, escape to cancel edit
- XSS-safe: task titles & tags are escaped

## 🧱 Tech Stack
Pure front-end: no frameworks, no build step.

## 📦 Data Persistence
- Tasks & settings stored in `localStorage` keys.
- Import adds tasks (does not overwrite existing).

## 📱 Install as App (PWA)
1. Open in Chrome/Edge mobile or desktop.
2. Use "Install App" / "Add to Home Screen" prompt or menu.
3. Launch like a native lightweight app.

## 🔔 Notifications
- Click the bell icon to enable.
- If blocked, adjust site permissions in your browser.
- Overdue check runs on load (shows count if any).

## 🛡 Security Notes
- User-generated text escaped to prevent HTML injection.
- No external network requests except icon font CDN.

## 🔄 Export / Import
- Export: downloads `tasks-export.json` containing an object `{ version, tasks }`.
- Import: merges tasks; invalid entries skipped.

## 🗂 Drag & Drop
- Reordering updates internal array order and persists.

## 🚀 Future Ideas
- Multi-list support
- Calendar view
- Recurring tasks
- Sync across devices
- Analytics for productivity

## 🔁 Recurring Tasks
When you choose a recurrence (Daily, Weekly, Monthly) and set a Due Date:
1. Complete the task → a new instance is created automatically with the next due date.
2. The original instance stays marked done for history.
3. Badge meanings: D = Daily, W = Weekly, M = Monthly.
4. Filter “Recurring” to view all tasks that have a recurrence rule.
If no due date is set, recurrence still tracks but next occurrence date will be blank (recommended to always set a due date for recurring items).

## 🧪 Testing Suggestions
Open DevTools > Application > Service Workers to ensure it's registered. Go offline and refresh to test caching.

## 📝 License
Do whatever you want. Educational / personal use friendly.

Enjoy! 🎯

## Undo / Redo

Implemented in-memory history (not persisted across reload):

Supported actions:
- Toggle done
- Edit (title, description, relations)
- Delete single task
- Clear completed (bulkDelete)
- Mark all done (bulkToggle)
- Reorder via drag & drop

Entry types stored:
`toggle | update | delete | bulkDelete | bulkToggle | reorder`

Limits / Notes:
- Max 100 entries (older pruned)
- Recurring next-instance spawn is not reversed when undoing the original toggle (design simplification)
- Import/Export not added to history
- Clearing completed then undo restores tasks at top (re-sorted by createdAt desc)
