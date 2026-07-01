import { Router, type IRouter } from "express";
import { eq, and, like, sql } from "drizzle-orm";
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

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Find-or-create a well-known "system" category and one subcategory under it,
// used to surface the salary remainder and the debt/installments as real
// subcategories in the account breakdown. Returns the subcategory id.
async function ensureSystemSubcategory(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  categoryName: string,
  categoryEmoji: string,
  subName: string,
  subEmoji: string,
): Promise<number> {
  let [cat] = await tx.select().from(categoriesTable).where(eq(categoriesTable.name, categoryName)).limit(1);
  if (!cat) {
    [cat] = await tx.insert(categoriesTable).values({ name: categoryName, emoji: categoryEmoji }).returning();
  }
  let [sub] = await tx
    .select()
    .from(subcategoriesTable)
    .where(and(eq(subcategoriesTable.categoryId, cat.id), eq(subcategoriesTable.name, subName)))
    .limit(1);
  if (!sub) {
    [sub] = await tx.insert(subcategoriesTable).values({ categoryId: cat.id, name: subName, emoji: subEmoji }).returning();
  }
  return sub.id;
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

router.post("/salary/process", async (req, res): Promise<void> => {
  const parsed = ProcessSalaryBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const month = parsed.data.month || currentMonthStr();
  const isCurrentMonth = month === currentMonthStr();

  const salaryRows = await db
    .select()
    .from(salaryTable)
    .limit(1);

  if (!salaryRows.length) {
    res.status(400).json({ error: "لم يتم تهيئة الراتب بعد" });
    return;
  }

  const salary = salaryRows[0];
  const today = new Date().getDate();

  if (isCurrentMonth && today < salary.depositDay) {
    res.json({ processed: false, alreadyProcessed: false, message: `موعد الإيداع لم يحن بعد (اليوم ${salary.depositDay} من الشهر)` });
    return;
  }

  if (!salary.accountId) {
    res.json({
      processed: false,
      alreadyProcessed: false,
      message: "حدد حساب الإيداع في إعدادات الراتب أولاً ثم أعد المعالجة",
    });
    return;
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
    res.json({
      processed: false,
      alreadyProcessed: false,
      message: `مجموع التوزيعات والأقساط (${committedTotal.toFixed(2)}) أكبر من الراتب (${salaryAmount.toFixed(2)})، عدّل التوزيعات ثم أعد المعالجة`,
    });
    return;
  }

  const allocsForBudget = await db.select().from(salaryAllocationsTable);
  const remainder = salaryAmount - committedTotal;

  // Processing a month is re-runnable: remove any previously created salary
  // deposits for this month (identified by their note prefix) and recreate them.
  // This also unblocks months that were logged as processed under older code
  // that never actually created a deposit. All writes happen in one transaction.
  await db.transaction(async (tx) => {
    // Serialize processing of the same month so two concurrent requests cannot
    // both delete-and-recreate and end up with duplicate deposits. The lock is
    // released automatically at the end of the transaction.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`salary-process-${month}`}))`);

    // The remainder and the loan installments are surfaced as their own
    // subcategories so they appear in the account breakdown (making the balance
    // add up) and can later be transferred to another account or spent from.
    // A global lock guards the find-or-create against races across months.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('salary-system-subcategories'))`);
    const remainderSubId = await ensureSystemSubcategory(tx, "المتبقي من الراتب", "💰", "المتبقي", "💰");
    const debtSubId = await ensureSystemSubcategory(tx, "الديون", "🏦", "الأقساط", "📄");

    // Remove ONLY the salary deposits previously created for this month. They
    // are deposits whose note starts with the salary prefix for this month, so
    // manual deposits/expenses are never touched.
    await tx
      .delete(transactionsTable)
      .where(
        and(
          eq(transactionsTable.type, "deposit"),
          like(transactionsTable.notes, `راتب ${month}%`),
        ),
      );

    // One categorized deposit per allocation so each shows up in the operations
    // list, the account statement, and as "received" per subcategory.
    for (const alloc of positiveAllocations) {
      const label = alloc.subcategoryName ?? alloc.categoryName ?? "";
      await tx.insert(transactionsTable).values({
        type: "deposit",
        amount: alloc.amount,
        date: dateStr,
        accountId,
        subcategoryId: alloc.subcategoryId ?? null,
        notes: `راتب ${month}${label ? ` - ${label}` : ""}`,
      });
    }

    // One deposit per active loan under the "الديون" subcategory so the debt
    // portion is visible in the breakdown and can be moved/spent later.
    for (const loan of activeLoans) {
      if (!(parseFloat(loan.monthlyInstallment) > 0)) continue;
      await tx.insert(transactionsTable).values({
        type: "deposit",
        amount: loan.monthlyInstallment,
        date: dateStr,
        accountId,
        subcategoryId: debtSubId,
        notes: `راتب ${month} - قسط ${loan.name}`,
      });
    }

    // Deposit any unallocated remainder under the "المتبقي من الراتب"
    // subcategory so the account balance equals the full salary and the leftover
    // can be transferred or spent later. If nothing was committed, this is the
    // entire salary.
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

    // Record the processing (idempotent — ignore if the month is already logged).
    await tx.insert(salaryProcessingLogTable).values({ processedMonth: month }).onConflictDoNothing();
  });

  res.json({ processed: true, alreadyProcessed: false, message: `تم إيداع راتب ${month} كاملاً في الحساب وتوزيعه على التصنيفات والأقساط` });
});

export default router;
