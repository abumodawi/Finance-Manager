---
name: Neon DATABASE_URL precedence
description: Why the app reads NEON_DATABASE_URL first and falls back to DATABASE_URL, plus the migration approach.
---

# Neon connection precedence

Both `lib/db/src/index.ts` (runtime pg Pool) and `lib/db/drizzle.config.ts`
(drizzle-kit push) resolve their connection as
`process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL`.

**Why:** the platform's built-in `DATABASE_URL` is *runtime-managed* — the agent
cannot overwrite it via setEnvVars, and it cannot be deleted. To switch the app to
an external Neon Postgres without fighting that restriction, the connection prefers
a separate secret `NEON_DATABASE_URL`. Secrets are global, so this applies to dev
and deployed/production alike.

**How to apply:**
- To point the whole app (incl. drizzle push) at Neon, ensure the `NEON_DATABASE_URL`
  secret is set. To revert to the built-in DB, unset it.
- Fallback risk: if `NEON_DATABASE_URL` is accidentally unset, the app silently
  falls back to the built-in `DATABASE_URL` (different DB → split data). If you ever
  need a hard guarantee, add a guard requiring `NEON_DATABASE_URL` when
  `NODE_ENV=production`.

# Migrating data between Postgres DBs (dev/built-in → Neon)

Do it from the **bash tool**, not the code_execution sandbox: newly-added secrets
are NOT present in the sandbox env even after `restart:true`, but each bash command
is a fresh process that inherits them. Reference URLs only via `"$VAR"` (never echo
the value). Neon requires SSL (`sslmode=require` in the URL); libpq pg_dump/psql
honor it natively.

Steps that worked: `pg_dump "$DATABASE_URL" --no-owner --no-acl -f dump.sql` then
`psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -f dump.sql`, then compare per-table
`count(*)` on both sides. Distinguish the two targets by `current_database()`
(built-in was `heliumdb`, Neon is `neondb`) — don't trust that `"$NEON_DATABASE_URL"`
resolved; an empty expansion silently connects to the local DB via PG* vars.
