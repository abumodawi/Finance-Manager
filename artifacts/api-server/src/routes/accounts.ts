import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, accountsTable, transactionsTable } from "@workspace/db";
import {
  CreateAccountBody,
  GetAccountParams,
  UpdateAccountParams,
  UpdateAccountBody,
  DeleteAccountParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function computeBalance(accountId: number, initialBalance: string): Promise<number> {
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount::numeric ELSE -amount::numeric END), 0)`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.accountId, accountId));
  const txTotal = parseFloat(result[0]?.total ?? "0");
  return parseFloat(initialBalance) + txTotal;
}

function formatAccount(a: typeof accountsTable.$inferSelect, balance: number) {
  return {
    id: a.id,
    name: a.name,
    bankName: a.bankName,
    accountNumber: a.accountNumber,
    emoji: a.emoji,
    imageUrl: a.imageUrl ?? null,
    balance,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/accounts", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(accountsTable).orderBy(accountsTable.createdAt);
  const withBalances = await Promise.all(
    accounts.map(async (a) => formatAccount(a, await computeBalance(a.id, a.initialBalance)))
  );
  res.json(withBalances);
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { initialBalance, ...rest } = parsed.data;
  const [account] = await db
    .insert(accountsTable)
    .values({ ...rest, initialBalance: String(initialBalance ?? 0) })
    .returning();
  res.status(201).json(formatAccount(account, parseFloat(account.initialBalance)));
});

router.get("/accounts/:id", async (req, res): Promise<void> => {
  const params = GetAccountParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, params.data.id));
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json(formatAccount(account, await computeBalance(account.id, account.initialBalance)));
});

router.patch("/accounts/:id", async (req, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [account] = await db
    .update(accountsTable)
    .set(parsed.data)
    .where(eq(accountsTable.id, params.data.id))
    .returning();
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json(formatAccount(account, await computeBalance(account.id, account.initialBalance)));
});

router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const params = DeleteAccountParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(accountsTable).where(eq(accountsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
