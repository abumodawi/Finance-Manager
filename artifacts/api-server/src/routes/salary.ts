import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, salaryTable, accountsTable, salaryAllocationsTable, categoriesTable, subcategoriesTable, transactionsTable, salaryProcessingLogTable } from "@workspace/db";
import {
  UpsertSalaryBody,
  CreateSalaryAllocationBody,
  UpdateSalaryAllocationParams,
  UpdateSalaryAllocationBody,
  DeleteSalaryAllocationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

router.post("/salary/process", async (_req, res): Promise<void> => {
  const month = currentMonthStr();

  const existing = await db
    .select()
    .from(salaryProcessingLogTable)
    .where(eq(salaryProcessingLogTable.processedMonth, month))
    .limit(1);

  if (existing.length) {
    res.json({ processed: false, alreadyProcessed: true, message: `تم معالجة راتب ${month} مسبقاً` });
    return;
  }

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

  if (today < salary.depositDay) {
    res.json({ processed: false, alreadyProcessed: false, message: `موعد الإيداع لم يحن بعد (اليوم ${salary.depositDay} من الشهر)` });
    return;
  }

  if (salary.accountId) {
    const dateStr = `${month}-${String(salary.depositDay).padStart(2, "0")}`;
    await db.insert(transactionsTable).values({
      type: "deposit",
      amount: salary.amount,
      date: dateStr,
      accountId: salary.accountId,
      notes: `راتب ${month}`,
    });
  }

  const allocations = await db.select().from(salaryAllocationsTable);
  for (const alloc of allocations) {
    await db
      .update(categoriesTable)
      .set({ budget: alloc.amount })
      .where(eq(categoriesTable.id, alloc.categoryId));
  }

  await db.insert(salaryProcessingLogTable).values({ processedMonth: month });

  res.json({ processed: true, alreadyProcessed: false, message: `تم معالجة راتب ${month} بنجاح` });
});

export default router;
