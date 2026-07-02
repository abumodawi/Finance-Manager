---
name: Vercel deployment of the Express API + Vite SPA
description: How this monorepo deploys to Vercel as one project, and why the catch-all function pattern was chosen over rewrites.
---

# Vercel deployment (single project)

The app deploys to Vercel as ONE project: Vite SPA served statically + Express API as a serverless function.

## API as a Vercel catch-all function (not a rewrite)

- `api/[...path].js` is a **committed** Vercel catch-all function that just does `module.exports = require("./_server.cjs")`.
- `_server.cjs` is the **generated** esbuild bundle of the Express app (entry `artifacts/api-server/src/vercel.ts`, which re-exports `app` with no `listen`). It is gitignored and produced by `pnpm --filter @workspace/api-server run build:vercel` during Vercel's `buildCommand`.
- **Why catch-all instead of a `"/api/(.*)" -> "/api"` rewrite:** Vercel natively routes `/api/*` to the catch-all and passes the ORIGINAL `req.url` (e.g. `/api/accounts`) unchanged, which is what Express's `app.use("/api", router)` needs. A destination rewrite's effect on `req.url` is ambiguous and risked collapsing every API call to `/api`.
- **Why `_server.cjs` (underscore prefix):** Vercel ignores `_`-prefixed files in `/api` for function detection but still traces them as a dependency of the committed catch-all. This makes function discovery reliable (the entry is committed) while the heavy bundle stays generated/gitignored.

## SPA fallback

- `vercel.json` rewrite `"/((?!api/).*)" -> "/index.html"`. Safe because Vercel checks the filesystem (static assets + functions) BEFORE applying rewrites, so `/assets/*` and `/api/*` are served/handled first.

## Serverless gotchas

- **runStartupBackfill does NOT run on Vercel** — it lives only in `src/index.ts` (the Replit listen entry), not `app.ts`/`vercel.ts`. Fine for a fresh DB; if importing legacy data, run backfill manually.
- **DB pool:** `lib/db` reads `DB_POOL_MAX` (unset = pg default 10). On Vercel set `DB_POOL_MAX=1` and use a pooled Postgres connection string (e.g. Neon pooler) to avoid connection exhaustion across warm instances.
- Logger uses pino-pretty transport only when `NODE_ENV!==production`; Vercel sets production, so plain JSON stdout (no worker threads) — safe for serverless.
