import { Router, type IRouter } from "express";
import { eq, and, or, like, inArray, sql } from "drizzle-orm";
import { db, salaryTable, accountsTable, salaryAllocationsTable, categoriesTable, subcategoriesTable, transactionsTable, salaryProcessingLogTable, loansTable } from "@workspace/db";
import {
  UpsertSalaryBody,
  CreateSalaryAllocationBody,
  UpdateSalaryAllocationParams,
  UpdateSalaryAllocationBody,
  DeleteSalaryAllocationParams,
  ProcessSalaryBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Find-or-create a well-known "system" category, renaming it IN PLACE if an older
// alias name is found (e.g. "المتبقي من الراتب" → "الإدخار") so previously tagged
// deposits keep their category and simply show under the new name.
async function ensureSystemCategory(
  tx: DbTx,
  opts: { aliases: string[]; name: string; emoji: string },
): Promise<number> {
  const names = Array.from(new Set([opts.name, ...opts.aliases]));
  let [cat] = await tx
    .select()
    .from(categoriesTable)
    .where(inArray(categoriesTable.name, names))
    .orderBy(categoriesTable.id)
    .limit(1);
  if (!cat) {
    [cat] = await tx.insert(categoriesTable).values({ name: opts.name, emoji: opts.emoji }).returning();
  } else if (cat.name !== opts.name) {
    [cat] = await tx
      .update(categoriesTable)
      .set({ name: opts.name, emoji: opts.emoji })
      .where(eq(categoriesTable.id, cat.id))
      .returning();
  }
  return cat.id;
}

// Find-or-create a subcategory by name under a category (idempotent). Used for
// per-loan debt subcategories and category-level allocation defaults.
async function ensureNamedSubcategory(
  tx: DbTx,
  categoryId: number,
  name: string,
  emoji: string,
): Promise<number> {
  let [sub] = await tx
    .select()
    .from(subcategoriesTable)
    .where(and(eq(subcategoriesTable.categoryId, categoryId), eq(subcategoriesTable.name, name)))
    .limit(1);
  if (!sub) {
    [sub] = await tx.insert(subcategoriesTable).values({ categoryId, name, emoji }).returning();
  }
  return sub.id;
}

// Ensure a system category that holds exactly ONE subcategory (e.g. savings:
// "الإدخار" → "إدخار"), renaming both category and its single sub in place so
// historical deposits tagged to it are preserved across renames.
async function ensureSingleSubSystemCategory(
  tx: DbTx,
  opts: { aliases: string[]; categoryName: string; categoryEmoji: string; subName: string; subEmoji: string },
): Promise<number> {
  const catId = await ensureSystemCategory(tx, { aliases: opts.aliases, name: opts.categoryName, emoji: opts.categoryEmoji });
  let [sub] = await tx
    .select()
    .from(subcategoriesTable)
    .where(eq(subcategoriesTable.categoryId, catId))
    .orderBy(subcategoriesTable.id)
    .limit(1);
  if (!sub) {
    [sub] = await tx.insert(subcategoriesTable).values({ categoryId: catId, name: opts.subName, emoji: opts.subEmoji }).returning();
  } else if (sub.name !== opts.subName) {
    [sub] = await tx
      .update(subcategoriesTable)
      .set({ name: opts.subName, emoji: opts.subEmoji })
      .where(eq(subcategoriesTable.id, sub.id))
      .returning();
  }
  return sub.id;
}

// For a category-level salary allocation (no subcategory chosen), tag it with a
// stable default subcategory named after the category so the allocated amount is
// visible in the account breakdown.
async function ensureCategoryDefaultSubcategory(tx: DbTx, categoryId: number): Promise<number> {
  const [cat] = await tx.select().from(categoriesTable).where(eq(categoriesTable.id, categoryId));
  return ensureNamedSubcategory(tx, categoryId, cat?.name ?? "عام", cat?.emoji ?? "📌");
}

function formatSalary(s: typeof salaryTable.$inferSelect, accountName: string | null) {
  return {
    id: s.id,
    amount: parseFloat(s.amount),
    depositDay: s.depositDay,
    accountId: s.accountId ?? null,
    accountName,
    notes: s.notes ?? null,
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/salary", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      salary: salaryTable,
      accountName: accountsTable.name,
    })
    .from(salaryTable)
    .leftJoin(accountsTable, eq(salaryTable.accountId, accountsTable.id))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "No salary configured" });
    return;
  }
  res.json(formatSalary(rows[0].salary, rows[0].accountName ?? null));
});

router.put("/salary", async (req, res): Promise<void> => {
  const parsed = UpsertSalaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { accountId, ...rest } = parsed.data;
  const existing = await db.select().from(salaryTable).limit(1);

  let saved: typeof salaryTable.$inferSelect;
  if (existing.length) {
    const [updated] = await db
      .update(salaryTable)
      .set({ amount: String(rest.amount), depositDay: rest.depositDay, notes: rest.notes ?? null, accountId: accountId ?? null })
      .returning();
    saved = updated;
  } else {
    const [inserted] = await db
      .insert(salaryTable)
      .values({ amount: String(rest.amount), depositDay: rest.depositDay, notes: rest.notes ?? null, accountId: accountId ?? null })
      .returning();
    saved = inserted;
  }

  let accountName: string | null = null;
  if (saved.accountId) {
    const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, saved.accountId));
    accountName = acc?.name ?? null;
  }

  res.json(formatSalary(saved, accountName));
});

router.get("/salary/allocations", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: salaryAllocationsTable.id,
      categoryId: salaryAllocationsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryEmoji: categoriesTable.emoji,
      subcategoryId: salaryAllocationsTable.subcategoryId,
      subcategoryName: subcategoriesTable.name,
      subcategoryEmoji: subcategoriesTable.emoji,
      amount: salaryAllocationsTable.amount,
    })
    .from(salaryAllocationsTable)
    .innerJoin(categoriesTable, eq(salaryAllocationsTable.categoryId, categoriesTable.id))
    .leftJoin(subcategoriesTable, eq(salaryAllocationsTable.subcategoryId, subcategoriesTable.id))
    .orderBy(salaryAllocationsTable.id);

  res.json(
    rows.map((r) => ({
      ...r,
      subcategoryId: r.subcategoryId ?? null,
      subcategoryName: r.subcategoryName ?? null,
      subcategoryEmoji: r.subcategoryEmoji ?? null,
      amount: parseFloat(r.amount),
    }))
  );
});

router.post("/salary/allocations", async (req, res): Promise<void> => {
  const parsed = CreateSalaryAllocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.subcategoryId != null) {
    const [sub] = await db
      .select()
      .from(subcategoriesTable)
      .where(eq(subcategoriesTable.id, parsed.data.subcategoryId));
    if (!sub || sub.categoryId !== parsed.data.categoryId) {
      res.status(400).json({ error: "Subcategory does not belong to the selected category" });
      return;
    }
  }
  const [row] = await db
    .insert(salaryAllocationsTable)
    .values({
      categoryId: parsed.data.categoryId,
      subcategoryId: parsed.data.subcategoryId ?? null,
      amount: String(parsed.data.amount),
    })
    .returning();

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, row.categoryId));
  let subName: string | null = null;
  let subEmoji: string | null = null;
  if (row.subcategoryId) {
    const [sub] = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.id, row.subcategoryId));
    subName = sub?.name ?? null;
    subEmoji = sub?.emoji ?? null;
  }
  res.status(201).json({
    id: row.id,
    categoryId: row.categoryId,
    categoryName: cat?.name ?? "",
    categoryEmoji: cat?.emoji ?? "📂",
    subcategoryId: row.subcategoryId ?? null,
    subcategoryName: subName,
    subcategoryEmoji: subEmoji,
    amount: parseFloat(row.amount),
  });
});

router.patch("/salary/allocations/:id", async (req, res): Promise<void> => {
  const params = UpdateSalaryAllocationParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSalaryAllocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(salaryAllocationsTable)
    .set({ amount: String(parsed.data.amount) })
    .where(eq(salaryAllocationsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Allocation not found" });
    return;
  }
  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, row.categoryId));
  let subName: string | null = null;
  let subEmoji: string | null = null;
  if (row.subcategoryId) {
    const [sub] = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.id, row.subcategoryId));
    subName = sub?.name ?? null;
    subEmoji = sub?.emoji ?? null;
  }
  res.json({
    id: row.id,
    categoryId: row.categoryId,
    categoryName: cat?.name ?? "",
    categoryEmoji: cat?.emoji ?? "📂",
    subcategoryId: row.subcategoryId ?? null,
    subcategoryName: subName,
    subcategoryEmoji: subEmoji,
    amount: parseFloat(row.amount),
  });
});

router.delete("/salary/allocations/:id", async (req, res): Promise<void> => {
  const params = DeleteSalaryAllocationParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(salaryAllocationsTable).where(eq(salaryAllocationsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Allocation not found" });
    return;
  }
  res.sendStatus(204);
});

export type SalaryProcessingOutcome =
  | { kind: "error"; status: number; message: string }
  | { kind: "skip"; message: string }
  | { kind: "done"; message: string };

// Core salary processing, shared by the HTTP route and the startup backfill so
// both apply identical rules. Deposits the FULL salary for a month, split across
// the allocations, one per-loan debt subcategory, and the savings remainder.
// Re-runnable: it deletes any prior salary deposits for the month (by note
// prefix) and recreates them inside a single transaction.
export async function runSalaryProcessing(
  month: string,
  opts: { skipDepositDayGuard?: boolean } = {},
): Promise<SalaryProcessingOutcome> {
  const isCurrentMonth = month === currentMonthStr();

  const salaryRows = await db.select().from(salaryTable).limit(1);
  if (!salaryRows.length) {
    return { kind: "error", status: 400, message: "لم يتم تهيئة الراتب بعد" };
  }
  const salary = salaryRows[0];
  const today = new Date().getDate();

  if (!opts.skipDepositDayGuard && isCurrentMonth && today < salary.depositDay) {
    return { kind: "skip", message: `موعد الإيداع لم يحن بعد (اليوم ${salary.depositDay} من الشهر)` };
  }
  if (!salary.accountId) {
    return { kind: "skip", message: "حدد حساب الإيداع في إعدادات الراتب أولاً ثم أعد المعالجة" };
  }

  const accountId = salary.accountId;
  const dateStr = `${month}-${String(salary.depositDay).padStart(2, "0")}`;
  const salaryAmount = parseFloat(salary.amount);

  // Fetch allocations with their category/subcategory names for labeling.
  const allocations = await db
    .select({
      amount: salaryAllocationsTable.amount,
      categoryId: salaryAllocationsTable.categoryId,
      subcategoryId: salaryAllocationsTable.subcategoryId,
      categoryName: categoriesTable.name,
      subcategoryName: subcategoriesTable.name,
    })
    .from(salaryAllocationsTable)
    .leftJoin(categoriesTable, eq(salaryAllocationsTable.categoryId, categoriesTable.id))
    .leftJoin(subcategoriesTable, eq(salaryAllocationsTable.subcategoryId, subcategoriesTable.id));

  const positiveAllocations = allocations.filter((a) => parseFloat(a.amount) > 0);
  const allocatedTotal = positiveAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);

  // Active loans are treated as a "debt" portion of the salary: each installment
  // becomes its own deposit so the debt shows up alongside the categories.
  const activeLoans = await db.select().from(loansTable).where(eq(loansTable.isActive, true));
  const loanTotal = activeLoans.reduce((sum, l) => sum + parseFloat(l.monthlyInstallment), 0);

  const committedTotal = allocatedTotal + loanTotal;

  // Guard: allocations + installments must not exceed the salary, otherwise the
  // total deposited would be larger than the salary and the balance would be wrong.
  if (committedTotal > salaryAmount + 0.009) {
    return {
      kind: "skip",
      message: `مجموع التوزيعات والأقساط (${committedTotal.toFixed(2)}) أكبر من الراتب (${salaryAmount.toFixed(2)})، عدّل التوزيعات ثم أعد المعالجة`,
    };
  }

  const allocsForBudget = await db.select().from(salaryAllocationsTable);
  const remainder = salaryAmount - committedTotal;

  await db.transaction(async (tx) => {
    // Serialize processing of the same month so two concurrent runs cannot both
    // delete-and-recreate and end up with duplicate deposits. Released at commit.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`salary-process-${month}`}))`);
    // Global lock guards the system category find-or-create against races.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('salary-system-subcategories'))`);

    const remainderSubId = await ensureSingleSubSystemCategory(tx, {
      aliases: ["المتبقي من الراتب"],
      categoryName: "الإدخار",
      categoryEmoji: "📥",
      subName: "إدخار",
      subEmoji: "📥",
    });
    const debtCategoryId = await ensureSystemCategory(tx, { aliases: [], name: "الديون", emoji: "🏦" });

    // Remove ONLY the salary deposits previously created for this month. Match
    // the exact system-generated note shapes ("راتب {month}" or
    // "راتب {month} - ...") so an unrelated manual note can never be caught.
    await tx
      .delete(transactionsTable)
      .where(
        and(
          eq(transactionsTable.type, "deposit"),
          or(
            eq(transactionsTable.notes, `راتب ${month}`),
            like(transactionsTable.notes, `راتب ${month} - %`),
          ),
        ),
      );

    // One categorized deposit per allocation.
    for (const alloc of positiveAllocations) {
      const label = alloc.subcategoryName ?? alloc.categoryName ?? "";
      // Category-level allocations (no subcategory) get a stable default
      // subcategory so their money is tagged and shows in the breakdown.
      const subId = alloc.subcategoryId ?? (await ensureCategoryDefaultSubcategory(tx, alloc.categoryId));
      await tx.insert(transactionsTable).values({
        type: "deposit",
        amount: alloc.amount,
        date: dateStr,
        accountId,
        subcategoryId: subId,
        notes: `راتب ${month}${label ? ` - ${label}` : ""}`,
      });
    }

    // One deposit per active loan, tagged to a subcategory NAMED AFTER THE LOAN
    // (under "الديون") so different debts stay distinguishable in the breakdown.
    for (const loan of activeLoans) {
      if (!(parseFloat(loan.monthlyInstallment) > 0)) continue;
      const loanSubId = await ensureNamedSubcategory(tx, debtCategoryId, loan.name, "📄");
      await tx.insert(transactionsTable).values({
        type: "deposit",
        amount: loan.monthlyInstallment,
        date: dateStr,
        accountId,
        subcategoryId: loanSubId,
        notes: `راتب ${month} - قسط ${loan.name}`,
      });
    }

    // Deposit any unallocated remainder under "الإدخار" so the account balance
    // equals the full salary. If nothing was committed, this is the whole salary.
    if (remainder > 0.009) {
      await tx.insert(transactionsTable).values({
        type: "deposit",
        amount: remainder.toFixed(2),
        date: dateStr,
        accountId,
        subcategoryId: remainderSubId,
        notes: committedTotal > 0.009 ? `راتب ${month} - غير موزع` : `راتب ${month}`,
      });
    }

    // Keep category budgets in sync with the allocations.
    for (const alloc of allocsForBudget) {
      await tx
        .update(categoriesTable)
        .set({ budget: alloc.amount })
        .where(eq(categoriesTable.id, alloc.categoryId));
    }

    // Remove the legacy shared "الأقساط" subcategory once it holds no
    // transactions (loans now use per-loan subcategories). Safe: only deleted
    // when empty, so any manual data under it is preserved.
    const legacyDebtSubs = await tx
      .select()
      .from(subcategoriesTable)
      .where(and(eq(subcategoriesTable.categoryId, debtCategoryId), eq(subcategoriesTable.name, "الأقساط")));
    for (const s of legacyDebtSubs) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(transactionsTable)
        .where(eq(transactionsTable.subcategoryId, s.id));
      if (Number(n) === 0) {
        await tx.delete(subcategoriesTable).where(eq(subcategoriesTable.id, s.id));
      }
    }

    // Record the processing (idempotent — ignore if the month is already logged).
    await tx.insert(salaryProcessingLogTable).values({ processedMonth: month }).onConflictDoNothing();
  });

  return { kind: "done", message: `تم إيداع راتب ${month} كاملاً في الحساب وتوزيعه على التصنيفات والأقساط` };
}

router.post("/salary/process", async (req, res): Promise<void> => {
  const parsed = ProcessSalaryBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const month = parsed.data.month || currentMonthStr();
  const outcome = await runSalaryProcessing(month);
  if (outcome.kind === "error") {
    res.status(outcome.status).json({ error: outcome.message });
    return;
  }
  res.json({ processed: outcome.kind === "done", alreadyProcessed: false, message: outcome.message });
});

export default router;
