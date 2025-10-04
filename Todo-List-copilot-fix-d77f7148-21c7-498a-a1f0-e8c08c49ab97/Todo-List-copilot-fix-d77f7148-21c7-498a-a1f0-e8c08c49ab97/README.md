# Todo PWA – Advanced Offline‑First Task Manager

Modern, offline-capable, feature-rich Todo Progressive Web App with: theming, recurrence, relationships graph, focus mode, reminders (snooze / dismiss), statistics, undo/redo, import/export (JSON / CSV / TXT / Markdown / ICS), Google Calendar quick-add, auto‑backups, accessibility enhancements, incremental rendering, and a pluggable auth adapter (local demo).

## ✨ Features
- Offline ready (Service Worker + cache versioning)
- IndexedDB / localStorage fallback storage abstraction
- Tasks: priority, tags, recurrence, relations, due dates, inline edit
- Undo / Redo history (50 states, jump & inspect)
- Import / Export (JSON / CSV / TXT / Markdown / ICS) with schema validation + auto backups
- Calendar quick-add (Google) + Notion-style copy block
- Focus Mode (single-task deep work) + keyboard nav
- Reminders (reminderAt + snooze 15m / 1h + dismiss)
- Incremental rendering (>200 tasks batched)
- Relations tooltip (hover to see related titles)
- Statistics dashboard (priority distribution, productivity bars, tag cloud, etc.)
- Relationship graph (visual task relations)
- Theming system (light/dark + accent themes + custom future support)
- Notifications: in-app + browser (due soon, overdue, recurring)
- Accessibility: ARIA roles, keyboard shortcuts, live regions
- Experimental Auth (local only, per‑user namespaced data) – NOT production security
- Animations & micro-interactions with reduced-motion respect

## 🧱 Architecture Overview
```
index.html          Shell + modals + mounting points
styles/             Base + themes + animations
js/app.js           Orchestrator (composition root)
js/task.js          Task model (logic & helpers)
js/storage.js       StorageManager (IndexedDB + fallback + namespacing)
js/ui.js            Rendering layer & event binding
js/search.js        Query filtering logic
js/stats.js         Metrics aggregation + UI
js/graph.js         Relationship visualization
js/undo-redo.js     History manager (state snapshots)
js/import-export.js Backup, parsing, migrations, validation
js/notifications.js In-app + browser notifications manager
js/themes.js        Theme manager (system + user switch)
js/auth.js          Local-only user registry & namespace (experimental)
sw.js               Service worker (cache strategy + versioning)
```

### Data Flow (Simplified)
User Action → UI Manager → App Controller → (Undo Save) → Task Mutation → StorageManager → UI Re-render → Notifications / Stats update.

### State Surfaces
- `TodoApp.tasks`: in-memory canonical list
- IndexedDB store: persistence (tasks / settings / history)
- LocalStorage: fallback + auth + auto-backups

## 🔐 Authentication Adapter (Pluggable)
Now using an adapter layer (`AuthService` + `AuthAdapter`) with a local demo (`LocalDemoAuthAdapter`). Swap in real auth (Firebase / Supabase / custom) later without touching core modules. Current local hash is NOT secure.

Upgrade path:
- Unit: Vitest / Jest (Task model, storage helpers, undo logic)
- Integration: Playwright (modal flows, import/export, keyboard shortcuts)
- Performance: Lighthouse (PWA, accessibility, best practices)

Sample unit targets:
1. `Task.validate()` edge cases
2. `UndoRedoManager` trimming & duplicate detection
3. Import validation rejects malformed priority / dates

## 🚀 Performance Considerations
Implemented:
- Incremental rendering (batches of 50 beyond 200 items)
- Lightweight DOM rebuild approach (vanilla modules)

Potential Next:
- True windowed virtualization
- Debounced & indexed search filtering
- Idle-time precomputed stats cache
- Web Worker for heavy import parsing

## ♿ Accessibility Checklist Implemented
- ARIA roles for banner / main / dialogs / list / listitem
- Live region for notifications & empty state
- Keyboard shortcuts: Add (Enter), Undo (Ctrl+Z), Redo (Ctrl+Shift+Z / Ctrl+Y), Search focus (Ctrl+F)
| Feature | Status | Notes |
|---------|--------|-------|
| Relationship Graph | ✅ | Visual connection context |
| Undo/Redo History Inspector | ✅ | Jump & preview metadata |
| Focus Mode | ✅ | Deep work view + navigation + snooze |
| Reminders + Snooze | ✅ | 15m / 1h / dismiss actions |
| Markdown / ICS Export | ✅ | Portable & calendar friendly |
| Incremental Rendering | ✅ | Batches >200 tasks |
| Google Calendar Quick Add | ✅ | Pre-filled event link |
| Smart Recurrence Assist | ⏳ | Suggest recurrence based on pattern |
| Private Local Profiles | ⚠️ | Demo adapter only – upgrade needed |
| Auto Backups | ✅ | Keeps last 5 snapshots |

## 🗺️ Roadmap
Short Term (Completed):
- Reminders & snooze actions
- Focus Mode overlay
- Incremental rendering
- Markdown & ICS export
- Google Calendar quick-add
- Relations tooltip

Next Short Term:
- Test harness (Vitest + basic specs)
- Edge case messaging (corrupt import fallback)
- README screenshots

Medium Term:
- Cloud sync adapter interface
- Push notifications / background sync
- Tag insights + heatmaps
- Bulk edit palette

Long Term:
- Real-time collaboration (WebSocket layer)
- Plugin system (custom task fields / automation rules)
- End-to-end encryption (local key vault)

## 🔄 Import / Export & Migrations
## 🧠 Contributing
1. Fork & branch: `feature/<name>`
5. Add tests (when harness added)

Suggested labels: `feat`, `fix`, `perf`, `a11y`, `refactor`, `docs`.

## 🛡️ Security Notes
- Auth (OAuth / email magic links / WebAuthn)
- CSRF mitigation (same-site cookies or tokens)
- XSS hardening (DOMPurify for rich input if added)
- Content Security Policy

## 🧩 Tech Choices
No heavy frameworks to keep bundle lean; vanilla modular JS + progressive enhancement. Easy to migrate core into a framework later (React/Vue/Svelte) if state complexity grows.

## 🧭 Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Enter (idle) | Open Add Task |
| Ctrl + Z | Undo |
| Ctrl + Shift + Z / Ctrl + Y | Redo |
| Ctrl + N | New Task Modal |
| Ctrl + F | Focus Search |
| Esc | Close modals |

## 🐛 Edge Cases & Resilience
- Namespaced storage per user
- IndexedDB → localStorage fallback
- Offline reminder queue reconciliation

## 📦 Build / Deployment
Static deployment ready (GitHub Pages / Netlify / Vercel). Ensure `sw.js` served from root for correct scope. Increment `APP_VERSION` in `sw.js` when static assets change to refresh cache.

### 🔗 Remote Backend (Node.js) Integration (Cookie + Token)
The app can connect to the bundled Node.js backend (`node-backend/`) for global accounts (any device / country) and persistent task storage.

Backend Quick Start:
```bash
cd node-backend
cp .env.example .env
npm install
npm run dev
```

Key Endpoints:
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Create user (auto-login) |
| POST | /auth/login | Login; sets httpOnly cookie + returns token |
| POST | /auth/logout | Clears session cookie |
| GET | /auth/me | Session introspection (returns userId) |
| GET | /api/tasks | List tasks |
| POST | /api/tasks | Create task |
| PUT | /api/tasks/:id | Update task |
| POST | /api/tasks/:id/toggle | Toggle completion |
| DELETE | /api/tasks/:id | Delete task |
| GET | /export | Download tasks JSON |
| POST | /import | Bulk import tasks |

Session Model:
- Short-lived JWT signed with `JWT_SECRET`.
- Sent both as response JSON (`{ token }`) and stored in an httpOnly cookie `todo_token` for automatic session restore (`/auth/me`).
- Frontend also stores token in `localStorage` for Authorization header on API calls (defense in depth; cookie fallback for cross-tab persistence).

Config (`.env`):
| Variable | Purpose |
|----------|---------|
| PORT | Server port |
| JWT_SECRET | HMAC secret for JWT signing (change in prod) |
| TOKEN_EXPIRE_HOURS | Token lifetime (and cookie max age) |
| DATA_DIR | Directory to persist JSON files |
| CORS_ORIGIN | Comma list of allowed origins ("*" dev) |
| NODE_ENV | production / development (enables secure cookies in prod) |

Frontend Activation:
In `index.html` (before other scripts):
```html
<script>window.TODO_API_BASE = 'http://localhost:8080';</script>
```
If omitted → local demo auth only (tasks stay browser-local).

Persistence & Reload Behavior:
- After login/register the cookie + localStorage token keep the user logged in across reloads.
- `/auth/me` is called silently on load to restore session even if localStorage token was cleared (cookie still valid).
- Tasks are always fetched from server after auth; local IndexedDB acts only as UI cache (future optimization) not authority.

Import / Export Migration:
1. While in local mode export tasks (JSON) via UI.
2. Enable backend (`TODO_API_BASE`), register/login.
3. Upload JSON to `/import` (UI Import) to seed remote account.

Security Notes:
- Always set a strong random `JWT_SECRET`.
- Serve over HTTPS (cookies rely on secure flag in production).
- Consider rate limiting `/auth/*` and brute-force protection.
- Move to a database (Postgres) before many concurrent users (current file store not atomic under heavy write load).

Planned Improvements:
- Return `username` in `/auth/me`.
- Refresh token rotation (separate cookie) & short access tokens.
- Optimistic sync & offline mutation queue.
- Task version conflict detection (updatedAt compare).

Fallback Strategy:
If backend unreachable → app can still operate locally when `TODO_API_BASE` is undefined. A future queued sync could merge later.

#### Refresh Tokens & Session Flow
- Access token (short-lived) + refresh token cookie (`todo_refresh`).
- On 401 the frontend attempts `/auth/refresh` once; if success it retries original request.
- Logout clears both `todo_token` & `todo_refresh` cookies and localStorage token.

#### Offline Task Queue
When offline or network fails:
1. Create/Update/Toggle/Delete operations are enqueued in `localStorage['todo-offline-queue']`.
2. Temporary IDs (`tmp_*`) used for creates (mapping to persisted ID to be implemented in UI layer).
3. On reconnect (`online` event) a flush iterates queue and retries operations; failures remain queued.
4. Future: mapping tempId → real id + conflict detection (compare updatedAt before overwriting).

Environment Additions:
| Variable | Purpose |
|----------|---------|
| REFRESH_SECRET | Separate HMAC secret for refresh tokens |
| REFRESH_EXPIRE_DAYS | Lifetime of refresh cookie |

Implementation Notes:
- Current refresh strategy reuses same refresh token (no rotation yet) – upgrade later for security hardening.
- File storage is not transactional; high concurrency may cause race overwrites (migrate to DB for production scale).

#### Sync Status Indicator
Header pill reflects remote sync state:
| State | Meaning |
|-------|---------|
| Synced (idle) | All operations flushed, no pending queue |
| Queued N | Offline or failures; N operations waiting to flush |
| Syncing... | Flush in progress |
| Offline | Browser offline (queue accumulating) |

Events emitted by `RemoteTaskService`:
- `status` (string): one of `idle|queued|syncing|offline`.
- `queue`: `{ size:number }` on queue changes.

Future Enhancements:
- Map tempId → real id in UI after create flush.
- Exponential backoff for repeated server failures.
- Visual toast when queue successfully drains.

Implemented: tempId mapping now updates local task IDs once server confirms creation (including queued offline creates). Relations referencing the temp ID are also rewritten.

#### Rate Limiting
In-memory fixed window limiter applied to authentication routes:
| Route | Max / Window (default) |
|-------|------------------------|
| POST /auth/register | 5 / 60s |
| POST /auth/login | 10 / 60s |
| POST /auth/refresh | 20 / 60s |

Environment Variables:
| Variable | Purpose |
|----------|---------|
| RATE_LIMIT_WINDOW_MS | Window size in ms (default 60000) |
| RATE_LIMIT_MAX | Default max requests per window (fallback baseline) |

Notes:
- 429 responses include `Retry-After` seconds.
- For horizontal scaling use a shared backend store (Redis) instead of in-memory map per instance.


## 📸 Screenshots (Planned)
- Add / Edit Task
- Focus Mode (active reminder)
- Relations tooltip
- Export chooser (JSON/CSV/TXT/MD/ICS)
- Incremental rendering progress bar
- Calendar quick-add

## ❤️ License
GNU GENERAL PUBLIC LICENSE – see `LICENSE`.

---
### 🛠 Migration Strategy (Local → Remote Backend)
Goal: Seamless upgrade without data loss while keeping offline fallback.

Phases:
1. Detection: When `window.TODO_API_BASE` set & user logs in remotely.
2. Snapshot: Export current local tasks (`storage.exportData()`).
3. Diff (future): Compare remote `/tasks` list to avoid duplicates (match by id; fallback title+createdAt heuristic).
4. Push: POST each missing task (batch or bulk endpoint later).
5. Mark: Set `localStorage['todo-remote-migrated']=true`.
6. Hybrid Mode (optional future): Continue capturing offline mutations into a queue flushed when online & authenticated.

Conflict Resolution (planned):
- If same task id exists remote & local: keep newest `updatedAt`.
- If structural validation fails server-side: push task to remote quarantine endpoint for later repair.

Rollback Plan:
- If migration fails mid-way, user remains on local data (remote namespace not activated until success flag set).

Instrumentation Ideas:
- Count migrated tasks, duration, failure reasons (aggregated anonymously if telemetry added later).


---