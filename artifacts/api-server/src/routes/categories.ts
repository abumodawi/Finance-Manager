import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, categoriesTable, subcategoriesTable, accountsTable, transactionsTable } from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryBody,
  DeleteCategoryParams,
  CreateSubcategoryBody,
  UpdateSubcategoryParams,
  UpdateSubcategoryBody,
  DeleteSubcategoryParams,
  ListCategoriesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function computeCategoryBalance(categoryId: number, month: string): Promise<number> {
  const result = await db
    .select({
      net: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.type} = 'deposit' THEN ${transactionsTable.amount}::numeric ELSE -${transactionsTable.amount}::numeric END), 0)`,
    })
    .from(transactionsTable)
    .innerJoin(subcategoriesTable, eq(transactionsTable.subcategoryId, subcategoriesTable.id))
    .where(
      and(
        eq(subcategoriesTable.categoryId, categoryId),
        sql`TO_CHAR(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`
      )
    );
  return parseFloat(result[0]?.net ?? "0");
}

async function getCategoryWithSubs(categoryId: number, month: string) {
  const [category] = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      emoji: categoriesTable.emoji,
      budget: categoriesTable.budget,
      accountId: categoriesTable.accountId,
      accountName: accountsTable.name,
    })
    .from(categoriesTable)
    .leftJoin(accountsTable, eq(categoriesTable.accountId, accountsTable.id))
    .where(eq(categoriesTable.id, categoryId));

  if (!category) return null;

  const subs = await db
    .select()
    .from(subcategoriesTable)
    .where(eq(subcategoriesTable.categoryId, categoryId))
    .orderBy(subcategoriesTable.createdAt);

  const budget = category.budget ? parseFloat(category.budget) : null;
  const txNet = await computeCategoryBalance(categoryId, month);
  const currentBalance = budget !== null ? budget + txNet : null;

  return {
    id: category.id,
    name: category.name,
    emoji: category.emoji,
    budget,
    currentBalance,
    accountId: category.accountId ?? null,
    accountName: category.accountName ?? null,
    subcategories: subs.map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name, emoji: s.emoji })),
  };
}

router.get("/categories", async (req, res): Promise<void> => {
  const qp = ListCategoriesQueryParams.safeParse(req.query);
  const month = qp.success && qp.data.month ? qp.data.month : currentMonthStr();

  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.createdAt);
  const result = await Promise.all(categories.map((c) => getCategoryWithSubs(c.id, month)));
  res.json(result.filter(Boolean));
});

router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { budget, accountId, ...rest } = parsed.data;
  const [cat] = await db
    .insert(categoriesTable)
    .values({ ...rest, budget: budget !== undefined && budget !== null ? String(budget) : null, accountId: accountId ?? null })
    .returning();
  res.status(201).json({
    id: cat.id,
    name: cat.name,
    emoji: cat.emoji,
    budget: cat.budget ? parseFloat(cat.budget) : null,
    currentBalance: cat.budget ? parseFloat(cat.budget) : null,
    accountId: cat.accountId ?? null,
    accountName: null,
    subcategories: [],
  });
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { budget, accountId, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (budget !== undefined) updateData.budget = budget !== null ? String(budget) : null;
  if (accountId !== undefined) updateData.accountId = accountId ?? null;

  const [updated] = await db
    .update(categoriesTable)
    .set(updateData)
    .where(eq(categoriesTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const month = currentMonthStr();
  const result = await getCategoryWithSubs(updated.id, month);
  res.json(result);
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(categoriesTable).where(eq(categoriesTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/subcategories", async (req, res): Promise<void> => {
  const parsed = CreateSubcategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [sub] = await db.insert(subcategoriesTable).values(parsed.data).returning();
  res.status(201).json({ id: sub.id, categoryId: sub.categoryId, name: sub.name, emoji: sub.emoji });
});

router.patch("/subcategories/:id", async (req, res): Promise<void> => {
  const params = UpdateSubcategoryParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSubcategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(subcategoriesTable).set(parsed.data).where(eq(subcategoriesTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Subcategory not found" });
    return;
  }
  res.json({ id: updated.id, categoryId: updated.categoryId, name: updated.name, emoji: updated.emoji });
});

router.delete("/subcategories/:id", async (req, res): Promise<void> => {
  const params = DeleteSubcategoryParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(subcategoriesTable).where(eq(subcategoriesTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Subcategory not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
