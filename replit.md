# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

### Run on localhost (no database required)

`DATABASE_URL` is **optional**. If it's not set, the server automatically uses a local JSON file store (`local-data.json` at the CWD, override via `LOCAL_DB_FILE`) — zero setup, data persists across restarts. If `DATABASE_URL` *is* set, it uses Postgres (run `pnpm --filter @workspace/db run push` once to create tables). Dispatch logic: `USE_LOCAL_STORE` in `lib/db/src/index.ts` + `lib/db/src/local-store.ts`.

- One command (recommended): `pnpm local` — builds the frontend + API, then runs the single server on http://localhost:10000 (admin at `/admin`). Uses `scripts/start-local.mjs` (sets `NODE_ENV=production`, `PORT`, runs from project root). If already built, just `pnpm start:local`.
- Manual production-style (one server serves API + built frontend):
  1. `pnpm --filter @workspace/tournament run build`
  2. `pnpm --filter @workspace/api-server run build`
  3. `NODE_ENV=production PORT=10000 node artifacts/api-server/dist/index.mjs` → open http://localhost:10000
  Run it from the **project root** so it finds `dev-admin.txt` / writes `local-data.json` there.

The `/admin` login page has three states: **enabled** (server up + `dev-admin.txt` present → auto-login, no password), **disabled** (server up, file absent → password form), **unreachable** (API server not running → shows "خادم الـ API غير متصل" + retry, instead of the password form).
- Dev (hot reload): run the API server in one terminal (`node artifacts/api-server/dist/index.mjs`, port 10000) and `pnpm --filter @workspace/tournament run dev` in another → open http://localhost:3000. Vite proxies `/api` to the API server (override target with `API_TARGET`).

Note (Windows): `optionalDependencies` in the root `package.json` pins the win32 native binaries for rollup/tailwind-oxide/lightningcss (pnpm skips them on Linux/mac deploys).

### Trial admin login for localhost (file toggle)

A file at the project root, `dev-admin.txt`, toggles a local "trial admin":

- File present → opening `/admin` **auto-logs you in with no password** (the login page checks `GET /admin/dev-status` on mount and, if enabled, calls `POST /admin/dev-login`). A manual "🔓 دخول تجريبي" button and the normal password form are also shown as fallbacks.
- Delete the file → the trial admin is disabled immediately (no server restart needed); the login page falls back to the password form and existing trial tokens stop working on the next request.
- Put the file back → it works again.

The trial token/password equals the file's contents (default `localadmin` if the file is empty). Resolved from `DEV_ADMIN_FILE` env var, else `dev-admin.txt` next to the process CWD, else the project root relative to the built server. The file is git-ignored so it never leaks to deploys.

Endpoints (in `artifacts/api-server/src/routes/tournament.ts`): `GET /admin/dev-status` → `{ enabled }`, `POST /admin/dev-login` → `{ token }` (only when the file exists). Logic lives in `getDevAdminPassword()`. The other admin passwords (`ADMIN_PASSWORD`, `SESSION_SECRET`, and the built-in ones) are unchanged; `adminLogin()` in `lib/api.ts` now parses responses safely and shows a clear message if the API server is unreachable (fixes the old "Unexpected end of JSON input" error).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/tournaments.ts`; DB helpers: `lib/db/src/index.ts`
- API routes: `artifacts/api-server/src/routes/tournament.ts`
- Frontend: `artifacts/tournament/src` (`pages/ViewerPage.tsx`, `pages/AdminPage.tsx`, `lib/api.ts`, `lib/types.ts`, `index.css`)
- Tournament records feature: table `tournament_records`; component `artifacts/tournament/src/components/TournamentRecordsPanel.tsx`; endpoints `GET/POST/DELETE /api/tournament/records`

## Tournament records (سجل البطولات)

- Admin adds a record (tournament name + winner name + image) from the Admin page card; images are canvas-compressed to a Base64 JPEG (max 1000px) and stored in the `tournament_records.image` text column.
- Records show live to viewers: a fixed right-side panel on wide screens (`.records-side`) and an inline block on narrow screens (`.records-inline`). Clicking a card opens a zoom modal of the image.
- Realtime updates reuse SSE: POST/DELETE `/records` call `broadcast()`, and the viewer re-fetches records on each SSE message. Body limit raised to 12mb (`app.ts`) for image payloads.

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
