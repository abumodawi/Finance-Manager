import { Router, type IRouter } from "express";
import { eq, and, gte, lte, lt, sql } from "drizzle-orm";
import { db, accountsTable, transactionsTable, subcategoriesTable, categoriesTable, salaryTable } from "@workspace/db";
import { GetSpendingByCategoryQueryParams, GetAccountStatementQueryParams, GetAccountBreakdownQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function monthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split("-");
  const start = `${year}-${mon}-01`;
  const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
  const end = `${year}-${mon}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function getAccountBalance(accountId: number, initialBalance: string): Promise<number> {
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount::numeric ELSE -amount::numeric END), 0)`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.accountId, accountId));
  return parseFloat(initialBalance) + parseFloat(result[0]?.total ?? "0");
}

router.get("/summary/dashboard", async (_req, res): Promise<void> => {
  const month = currentMonth();
  const { start, end } = monthRange(month);

  const accounts = await db.select().from(accountsTable);
  const accountBalances = await Promise.all(
    accounts.map(async (a) => ({
      accountId: a.id,
      name: a.name,
      emoji: a.emoji,
      bankName: a.bankName,
      balance: await getAccountBalance(a.id, a.initialBalance),
    }))
  );

  const totalBalance = accountBalances.reduce((sum, a) => sum + a.balance, 0);

  const monthlyTx = await db
    .select()
    .from(transactionsTable)
    .where(and(gte(transactionsTable.date, start), lte(transactionsTable.date, end)));

  const monthlyExpenses = monthlyTx
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const monthlyDeposits = monthlyTx
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const salaryRows = await db.select().from(salaryTable).limit(1);
  const salary = salaryRows[0] ? parseFloat(salaryRows[0].amount) : null;
  const depositDay = salaryRows[0]?.depositDay ?? null;

  res.json({
    totalBalance,
    monthlyExpenses,
    monthlyDeposits,
    salary,
    depositDay,
    currentMonth: month,
    accountBalances,
  });
});

router.get("/summary/spending-by-category", async (req, res): Promise<void> => {
  const qp = GetSpendingByCategoryQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const month = qp.data.month ?? currentMonth();
  const { start, end } = monthRange(month);

  const txRows = await db
    .select({
      amount: transactionsTable.amount,
      subcategoryId: transactionsTable.subcategoryId,
      subName: subcategoriesTable.name,
      subEmoji: subcategoriesTable.emoji,
      catId: categoriesTable.id,
      catName: categoriesTable.name,
      catEmoji: categoriesTable.emoji,
    })
    .from(transactionsTable)
    .leftJoin(subcategoriesTable, eq(transactionsTable.subcategoryId, subcategoriesTable.id))
    .leftJoin(categoriesTable, eq(subcategoriesTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(transactionsTable.type, "expense"),
        gte(transactionsTable.date, start),
        lte(transactionsTable.date, end)
      )
    );

  const categoryMap = new Map<
    number,
    { categoryId: number; categoryName: string; emoji: string; total: number; subcategories: Map<number, { subcategoryId: number; name: string; emoji: string; total: number }> }
  >();

  for (const tx of txRows) {
    const amount = parseFloat(tx.amount);
    if (!tx.catId) continue;

    if (!categoryMap.has(tx.catId)) {
      categoryMap.set(tx.catId, {
        categoryId: tx.catId,
        categoryName: tx.catName ?? "غير مصنف",
        emoji: tx.catEmoji ?? "📂",
        total: 0,
        subcategories: new Map(),
      });
    }
    const cat = categoryMap.get(tx.catId)!;
    cat.total += amount;

    if (tx.subcategoryId != null) {
      if (!cat.subcategories.has(tx.subcategoryId)) {
        cat.subcategories.set(tx.subcategoryId, {
          subcategoryId: tx.subcategoryId,
          name: tx.subName ?? "غير مصنف",
          emoji: tx.subEmoji ?? "📌",
          total: 0,
        });
      }
      cat.subcategories.get(tx.subcategoryId)!.total += amount;
    }
  }

  const result = Array.from(categoryMap.values()).map((c) => ({
    categoryId: c.categoryId,
    categoryName: c.categoryName,
    emoji: c.emoji,
    total: c.total,
    subcategories: Array.from(c.subcategories.values()),
  }));

  res.json(result);
});

router.get("/summary/account-statement", async (req, res): Promise<void> => {
  const qp = GetAccountStatementQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const accountId = qp.data.accountId;
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const conditions = [eq(transactionsTable.accountId, accountId)];
  if (qp.data.month) {
    const { start, end } = monthRange(qp.data.month);
    conditions.push(gte(transactionsTable.date, start));
    conditions.push(lte(transactionsTable.date, end));
  }

  const txRows = await db
    .select({
      id: transactionsTable.id,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      date: transactionsTable.date,
      notes: transactionsTable.notes,
      subcategoryId: transactionsTable.subcategoryId,
      subName: subcategoriesTable.name,
      catName: categoriesTable.name,
    })
    .from(transactionsTable)
    .leftJoin(subcategoriesTable, eq(transactionsTable.subcategoryId, subcategoriesTable.id))
    .leftJoin(categoriesTable, eq(subcategoriesTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(transactionsTable.date, transactionsTable.id);

  // Compute opening balance = initialBalance + all transactions strictly BEFORE the filter period
  let openingBalance = parseFloat(account.initialBalance);
  if (qp.data.month) {
    const { start } = monthRange(qp.data.month);
    const allPrior = await db
      .select({ total: sql<string>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount::numeric ELSE -amount::numeric END), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.accountId, accountId), lt(transactionsTable.date, start)));
    openingBalance = parseFloat(account.initialBalance) + parseFloat(allPrior[0]?.total ?? "0");
  }

  let runningBalance = openingBalance;
  const entries = txRows.map((t) => {
    const amount = parseFloat(t.amount);
    runningBalance += t.type === "deposit" ? amount : -amount;
    return {
      id: t.id,
      type: t.type,
      amount,
      date: t.date,
      subcategoryName: t.subName ?? null,
      categoryName: t.catName ?? null,
      notes: t.notes ?? null,
      runningBalance,
    };
  });

  const closingBalance = runningBalance;

  res.json({
    account: {
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      emoji: account.emoji,
      balance: closingBalance,
      createdAt: account.createdAt.toISOString(),
    },
    openingBalance,
    closingBalance,
    transactions: entries,
  });
});

router.get("/summary/account-breakdown", async (req, res): Promise<void> => {
  const qp = GetAccountBreakdownQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const accountId = qp.data.accountId;
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.id);
  const subs = await db.select().from(subcategoriesTable).orderBy(subcategoriesTable.id);

  const agg = await db
    .select({
      subcategoryId: transactionsTable.subcategoryId,
      received: sql<string>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount::numeric ELSE 0 END), 0)`,
      spent: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount::numeric ELSE 0 END), 0)`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.accountId, accountId))
    .groupBy(transactionsTable.subcategoryId);

  const aggMap = new Map<number, { received: number; spent: number }>();
  // Money on transactions with no subcategory is bucketed into an "غير مصنف"
  // (uncategorized) group so it is never hidden and the sum of all categories
  // plus the initial balance always equals the current balance.
  let uncategorized = { received: 0, spent: 0 };
  for (const row of agg) {
    if (row.subcategoryId != null) {
      aggMap.set(row.subcategoryId, {
        received: parseFloat(row.received),
        spent: parseFloat(row.spent),
      });
    } else {
      uncategorized = { received: parseFloat(row.received), spent: parseFloat(row.spent) };
    }
  }

  let totalReceived = 0;
  let totalSpent = 0;

  const categories = cats
    .map((cat) => {
      const catSubs = subs
        .filter((s) => s.categoryId === cat.id && aggMap.has(s.id))
        .map((s) => {
          const a = aggMap.get(s.id) ?? { received: 0, spent: 0 };
          return {
            id: s.id,
            name: s.name,
            emoji: s.emoji,
            received: a.received,
            spent: a.spent,
            net: a.received - a.spent,
          };
        })
        // Hide subcategories whose remaining balance is zero (e.g. fully spent
        // or fully transferred out), so they no longer clutter the account.
        .filter((s) => Math.abs(s.net) > 0.005);
      for (const s of catSubs) {
        totalReceived += s.received;
        totalSpent += s.spent;
      }
      return {
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji,
        subcategories: catSubs,
      };
    })
    .filter((c) => c.subcategories.length > 0);

  if (Math.abs(uncategorized.received - uncategorized.spent) > 0.005) {
    totalReceived += uncategorized.received;
    totalSpent += uncategorized.spent;
    categories.push({
      id: -1,
      name: "غير مصنف",
      emoji: "❓",
      subcategories: [
        {
          id: -1,
          name: "غير مصنف",
          emoji: "❓",
          received: uncategorized.received,
          spent: uncategorized.spent,
          net: uncategorized.received - uncategorized.spent,
        },
      ],
    });
  }

  res.json({
    account: {
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      emoji: account.emoji,
      balance: await getAccountBalance(account.id, account.initialBalance),
      createdAt: account.createdAt.toISOString(),
    },
    totalReceived,
    totalSpent,
    categories,
  });
});

export default router;
