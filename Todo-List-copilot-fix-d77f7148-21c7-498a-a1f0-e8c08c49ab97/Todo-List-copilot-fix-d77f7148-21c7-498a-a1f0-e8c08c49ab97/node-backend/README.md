# Node.js Backend (Express)

A simple alternative implementation of the Todo backend using Node.js + Express with file-based JSON storage.

## Features
- User register/login (bcrypt hashed passwords, JWT auth)
- Task CRUD (per-user) stored in JSON files (`data/users.json`, `data/tasks.json`)
- CORS enabled (open `*` for now)
- Minimal, no external DB required

## Quick Start
```bash
cd node-backend
cp .env.example .env   # on PowerShell: Copy-Item .env.example .env
npm install
npm run dev
```
Health check: http://localhost:8080/health

## Env Vars
| Name | Default | Description |
|------|---------|-------------|
| PORT | 8080 | Port to listen |
| JWT_SECRET | dev-insecure-secret | Change in production |
| TOKEN_EXPIRE_HOURS | 24 | Token lifetime |
| DATA_DIR | ./data | Directory for JSON files |

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| POST | /auth/register | Register user (accepts JSON, form-data, urlencoded) |
| POST | /auth/login | Login, returns {token} |
| GET | /api/tasks | List tasks (Auth) |
| POST | /api/tasks | Create task (title, description?) |
| GET | /api/tasks/:id | Get single task |
| PUT | /api/tasks/:id | Update task (partial) |
| POST | /api/tasks/:id/toggle | Toggle completed state |
| DELETE | /api/tasks/:id | Delete task |
| GET | /export | Export tasks JSON (attachment) |
| POST | /import | Import tasks (JSON array) |

## Example HTTPie Flow
```bash
# Register (JSON or form)
http POST :8080/auth/register username=demo password=Passw0rd!

# Login
TOKEN=$(http -b POST :8080/auth/login username=demo password=Passw0rd! | jq -r .token)

# Create + List
http POST :8080/api/tasks title='Test' description='From node' "Authorization:Bearer $TOKEN"
http GET :8080/api/tasks "Authorization:Bearer $TOKEN"

# Toggle first task
FIRST=$(http -b GET :8080/api/tasks "Authorization:Bearer $TOKEN" | jq -r '.[0].id')
http POST :8080/api/tasks/$FIRST/toggle "Authorization:Bearer $TOKEN"

# Export
http GET :8080/export "Authorization:Bearer $TOKEN" -d exported.json

# Import (re-import exported file)
http POST :8080/import "Authorization:Bearer $TOKEN" < exported.json
```

## Notes / Next Steps
- Replace file storage with SQLite / Postgres for concurrency safety & scaling.
- Add rate limiting (express-rate-limit) and validation (zod / joi).
- Add refresh tokens & logout blacklist if needed.
- Restrict CORS origins.
- Migrate storage to SQLite / Postgres for concurrency & integrity.
