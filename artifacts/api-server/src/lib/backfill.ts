import { and, eq, like } from "drizzle-orm";
import { db, transactionsTable, salaryProcessingLogTable } from "@workspace/db";
import { runSalaryProcessing } from "../routes/salary";
import { logger } from "./logger";

// Bump the suffix to re-run the backfill after a change to salary processing
// rules. Stored as a sentinel row in the processing log so it runs exactly once.
const BACKFILL_SENTINEL = "__backfill_perloan_rename_v1__";
const SALARY_MONTH_RE = /^راتب\s+(\d{4}-\d{2})/;

// One-time, on-deploy data healer: re-runs salary processing for every month
// that already has salary deposits, so existing data picks up the current rules
// (in-place category renames, per-loan debt subcategories, tagged surplus)
// WITHOUT the user having to manually reprocess each month. Idempotent and safe:
// reprocessing only ever deletes-and-recreates that month's own salary deposits.
export async function runStartupBackfill(): Promise<void> {
  try {
    const [done] = await db
      .select()
      .from(salaryProcessingLogTable)
      .where(eq(salaryProcessingLogTable.processedMonth, BACKFILL_SENTINEL))
      .limit(1);
    if (done) return;

    const rows = await db
      .select({ notes: transactionsTable.notes })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "deposit"), like(transactionsTable.notes, "راتب %")));

    const months = new Set<string>();
    for (const r of rows) {
      const m = r.notes?.match(SALARY_MONTH_RE);
      if (m) months.add(m[1]);
    }

    let allDone = true;
    if (months.size > 0) {
      logger.info({ months: [...months] }, "Salary backfill: reprocessing existing months");
      for (const month of [...months].sort()) {
        const outcome = await runSalaryProcessing(month, { skipDepositDayGuard: true });
        if (outcome.kind !== "done") allDone = false;
        logger.info({ month, outcome: outcome.kind, message: outcome.message }, "Salary backfill month");
      }
    }

    // Only mark the backfill complete when EVERY targeted month actually
    // migrated. If any month was skipped or errored, leave the sentinel unset so
    // the backfill retries on the next start rather than permanently suppressing
    // itself with data left unmigrated.
    if (allDone) {
      await db.insert(salaryProcessingLogTable).values({ processedMonth: BACKFILL_SENTINEL }).onConflictDoNothing();
      logger.info({ migratedMonths: months.size }, "Salary backfill complete");
    } else {
      logger.warn("Salary backfill incomplete (some months skipped/errored); will retry on next start");
    }
  } catch (err) {
    logger.error({ err }, "Salary backfill failed");
  }
}
