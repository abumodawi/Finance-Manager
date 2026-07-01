---
name: Date columns vs zod coerce.date()
description: Drizzle date columns are string-mode but generated zod uses coerce.date(), so insert/update values must be converted to YYYY-MM-DD strings.
---

# Date columns are string-mode; zod produces Date objects

Drizzle `date()` columns in this project are string-mode (they expect `string`), but
the Orval-generated zod schemas (from `format: date` in the OpenAPI spec) use
`zod.coerce.date()`, so `parsed.data.<field>` is a JavaScript `Date`.

**Rule:** when inserting/updating a date column, convert the parsed value with
`someDate.toISOString().slice(0, 10)` before passing it to drizzle. Passing the raw
`Date` produces a TS2769 "Type 'Date' is not assignable to type 'string'" error.

**Why:** the two sides of the contract disagree on the date representation. The DB
wants `YYYY-MM-DD` strings; codegen coerces incoming JSON strings into `Date`. Runtime
often survives (pg serializes the Date) but typecheck fails and timezone drift is
possible if you rely on implicit serialization.

**How to apply:** applies to any route that writes a date column (e.g. loan
`startDate`, transaction `date`). Also affects statement/breakdown date filters — build
date-range comparisons with explicit `lt`/`gte` on the string column, never construct
invalid strings like `YYYY-MM-00`.
