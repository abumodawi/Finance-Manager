import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, transactionsTable, subcategoriesTable, categoriesTable, accountsTable } from "@workspace/db";
import {
  CreateTransactionBody,
  UpdateTransactionParams,
  UpdateTransactionBody,
  DeleteTransactionParams,
  ListTransactionsQueryParams,
  MoveSubcategoryFundsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichTransaction(t: typeof transactionsTable.$inferSelect) {
  let subcategoryName: string | null = null;
  let categoryName: string | null = null;

  if (t.subcategoryId) {
    const [sub] = await db
      .select({ subName: subcategoriesTable.name, catName: categoriesTable.name })
      .from(subcategoriesTable)
      .leftJoin(categoriesTable, eq(subcategoriesTable.categoryId, categoriesTable.id))
      .where(eq(subcategoriesTable.id, t.subcategoryId));
    subcategoryName = sub?.subName ?? null;
    categoryName = sub?.catName ?? null;
  }

  return {
    id: t.id,
    type: t.type,
    amount: parseFloat(t.amount),
    date: t.date,
    accountId: t.accountId,
    subcategoryId: t.subcategoryId ?? null,
    subcategoryName,
    categoryName,
    notes: t.notes ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/transactions", async (req, res): Promise<void> => {
  const qp = ListTransactionsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const conditions = [];
  if (qp.data.accountId != null) {
    conditions.push(eq(transactionsTable.accountId, qp.data.accountId));
  }
  if (qp.data.type != null) {
    conditions.push(eq(transactionsTable.type, qp.data.type));
  }
  if (qp.data.month != null) {
    const [year, month] = qp.data.month.split("-");
    const start = `${year}-${month}-01`;
    const end = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];
    conditions.push(gte(transactionsTable.date, start));
    conditions.push(lte(transactionsTable.date, end));
  }

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(transactionsTable.date, transactionsTable.createdAt);

  const enriched = await Promise.all(rows.map(enrichTransaction));
  res.json(enriched);
});

router.post("/transactions", async (req, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [t] = await db
    .insert(transactionsTable)
    .values({
      type: parsed.data.type,
      amount: String(parsed.data.amount),
      date: parsed.data.date.toISOString().slice(0, 10),
      accountId: parsed.data.accountId,
      subcategoryId: parsed.data.subcategoryId ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  res.status(201).json(await enrichTransaction(t));
});

router.patch("/transactions/:id", async (req, res): Promise<void> => {
  const params = UpdateTransactionParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  if (parsed.data.date !== undefined) updateData.date = parsed.data.date;
  if (parsed.data.accountId !== undefined) updateData.accountId = parsed.data.accountId;
  if ("subcategoryId" in parsed.data) updateData.subcategoryId = parsed.data.subcategoryId ?? null;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes ?? null;

  const [t] = await db
    .update(transactionsTable)
    .set(updateData)
    .where(eq(transactionsTable.id, params.data.id))
    .returning();
  if (!t) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(await enrichTransaction(t));
});

router.post("/transactions/move", async (req, res): Promise<void> => {
  const parsed = MoveSubcategoryFundsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { subcategoryId, fromAccountId, toAccountId } = parsed.data;

  if (fromAccountId === toAccountId) {
    res.status(400).json({ error: "الحساب المصدر والوجهة متطابقان" });
    return;
  }

  const [sub] = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.id, subcategoryId));
  if (!sub) {
    res.status(404).json({ error: "التصنيف الفرعي غير موجود" });
    return;
  }
  const [toAccount] = await db.select().from(accountsTable).where(eq(accountsTable.id, toAccountId));
  if (!toAccount) {
    res.status(404).json({ error: "الحساب الوجهة غير موجود" });
    return;
  }

  const moved = await db
    .update(transactionsTable)
    .set({ accountId: toAccountId })
    .where(
      and(
        eq(transactionsTable.accountId, fromAccountId),
        eq(transactionsTable.subcategoryId, subcategoryId),
      ),
    )
    .returning({ id: transactionsTable.id });

  res.json({ moved: moved.length });
});

router.delete("/transactions/:id", async (req, res): Promise<void> => {
  const params = DeleteTransactionParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(transactionsTable).where(eq(transactionsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
