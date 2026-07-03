import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Prefer NEON_DATABASE_URL when present (external Neon Postgres); fall back to
// the platform-managed DATABASE_URL. This lets us point the app at Neon without
// overwriting the runtime-managed DATABASE_URL secret.
const connectionString =
  process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// In serverless environments (e.g. Vercel) many warm instances can each hold a
// pool, so cap connections per instance via DB_POOL_MAX (set it to 1 on Vercel
// and use a pooled connection string). Unset preserves pg's default (max 10).
const poolMax = process.env.DB_POOL_MAX
  ? Number(process.env.DB_POOL_MAX)
  : undefined;

export const pool = new Pool({
  connectionString,
  ...(poolMax && Number.isFinite(poolMax) ? { max: poolMax } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
