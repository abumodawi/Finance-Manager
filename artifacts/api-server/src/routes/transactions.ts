import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
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
  const { subcategoryId, fromAccountId, toAccountId, toSubcategoryId, amount } = parsed.data;

  if (fromAccountId === toAccountId) {
    res.status(400).json({ error: "الحساب المصدر والوجهة متطابقان" });
    return;
  }

  const [sub] = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.id, subcategoryId));
  if (!sub) {
    res.status(404).json({ error: "التصنيف الفرعي غير موجود" });
    return;
  }

  // Optional destination subcategory. When provided, the moved funds are
  // re-tagged to it in the target account; when omitted they keep their
  // original subcategory.
  if (toSubcategoryId != null) {
    const [targetSub] = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.id, toSubcategoryId));
    if (!targetSub) {
      res.status(404).json({ error: "التصنيف الفرعي الوجهة غير موجود" });
      return;
    }
  }
  const destSubcategoryId = toSubcategoryId ?? subcategoryId;
  const [fromAccount] = await db.select().from(accountsTable).where(eq(accountsTable.id, fromAccountId));
  const [toAccount] = await db.select().from(accountsTable).where(eq(accountsTable.id, toAccountId));
  if (!fromAccount || !toAccount) {
    res.status(404).json({ error: "الحساب غير موجود" });
    return;
  }

  // Normalize the requested amount to currency precision (2 decimals) so
  // comparisons against the available balance are deterministic.
  const requested = amount == null ? null : Math.round(amount * 100) / 100;
  if (requested != null && requested <= 0) {
    res.status(400).json({ error: "المبلغ يجب أن يكون أكبر من صفر" });
    return;
  }

  // Do the read (available balance) AND the mutation inside ONE transaction,
  // guarded by an advisory lock scoped to this (source account, subcategory).
  // This serializes concurrent moves so two partial transfers can never both
  // pass validation and overdraw the same balance.
  const outcome = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`subcat-move-${fromAccountId}-${subcategoryId}`}))`);

    const sourceRows = await tx
      .select({ type: transactionsTable.type, amount: transactionsTable.amount })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.accountId, fromAccountId), eq(transactionsTable.subcategoryId, subcategoryId)));

    const available =
      Math.round(
        sourceRows.reduce(
          (sum, t) => sum + (t.type === "deposit" ? parseFloat(t.amount) : -parseFloat(t.amount)),
          0,
        ) * 100,
      ) / 100;

    if (available <= 0) {
      return { moved: 0 };
    }

    // No amount, or an amount that covers (or exceeds) the whole balance → move
    // everything by reassigning the transactions (no leftover, keeps history).
    if (requested == null || requested >= available) {
      const moved = await tx
        .update(transactionsTable)
        .set({ accountId: toAccountId, subcategoryId: destSubcategoryId })
        .where(and(eq(transactionsTable.accountId, fromAccountId), eq(transactionsTable.subcategoryId, subcategoryId)))
        .returning({ id: transactionsTable.id });
      return { moved: moved.length };
    }

    // Partial transfer: keep the remainder in the source account by creating a
    // balancing pair — an expense in the source and a deposit in the target,
    // both tagged to the same subcategory. Same transaction, so the money can
    // never be duplicated or lost midway.
    const today = new Date().toISOString().slice(0, 10);
    const value = requested.toFixed(2);
    await tx.insert(transactionsTable).values({
      type: "expense",
      amount: value,
      date: today,
      accountId: fromAccountId,
      subcategoryId,
      notes: `تحويل إلى ${toAccount.name}`,
    });
    await tx.insert(transactionsTable).values({
      type: "deposit",
      amount: value,
      date: today,
      accountId: toAccountId,
      subcategoryId: destSubcategoryId,
      notes: `تحويل من ${fromAccount.name}`,
    });
    return { moved: 2 };
  });

  res.json(outcome);
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
