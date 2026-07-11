# IK3MO Tournament

A real-time tournament management platform for the iK3MO gaming community, built as a pnpm monorepo.

## Architecture

| Artifact | Path | Purpose |
|---|---|---|
| Frontend | `artifacts/tournament` | React + Vite + Tailwind CSS viewer/admin UI |
| API Server | `artifacts/api-server` | Express + Drizzle ORM backend |
| Mockup Sandbox | `artifacts/mockup-sandbox` | Design/component preview (internal) |

**Shared libraries** (`lib/`):
- `lib/db` — Drizzle ORM schema & PostgreSQL client
- `lib/api-spec` — API endpoint definitions
- `lib/api-zod` — Shared Zod validation schemas
- `lib/api-client-react` — TanStack Query hooks for the frontend

## Running

All three workflows are configured and start automatically:
- `artifacts/tournament: web` — Vite dev server for the frontend
- `artifacts/api-server: API Server` — Express API (builds with esbuild then starts)
- `artifacts/mockup-sandbox: Component Preview Server` — Design sandbox

## Environment Variables & Secrets

| Variable | Type | Notes |
|---|---|---|
| `DATABASE_URL` | Runtime-managed | Auto-injected by Replit (PostgreSQL) |
| `ADMIN_PASSWORD` | Secret | Protects admin routes in production |
| `PORT` | Runtime-managed | Auto-assigned per artifact |
| `NODE_ENV` | Auto | Set to `development` in dev script |

Optional (dev only):
- `LOCAL_DB_FILE` — fallback JSON store path (used when DATABASE_URL is absent)
- `DEV_ADMIN_FILE` — dev admin credentials file
- `LOG_LEVEL` — Pino log level

## Database

PostgreSQL via Replit's managed database. Schema is managed with Drizzle Kit:

```bash
cd lib/db && pnpm run push   # apply schema changes to dev DB
```

Schema lives in `lib/db/src/schema/`.

## Real-time

Uses **Pusher** (client-side only) for live chat. The public Pusher key is hardcoded in `artifacts/tournament/src/pages/AdminPage.tsx`. No server-side Pusher credentials are required.

## User Preferences

- Keep the existing monorepo structure intact
- Arabic is used in comments and some UI text — preserve it
