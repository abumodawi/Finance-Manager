import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, loansTable } from "@workspace/db";
import { CreateLoanBody, UpdateLoanParams, UpdateLoanBody, DeleteLoanParams } from "@workspace/api-zod";

const router: IRouter = Router();

function formatLoan(l: typeof loansTable.$inferSelect) {
  return {
    id: l.id,
    name: l.name,
    totalAmount: parseFloat(l.totalAmount),
    monthlyInstallment: parseFloat(l.monthlyInstallment),
    months: l.months,
    startDate: l.startDate,
    remainingMonths: l.remainingMonths,
    isActive: l.isActive,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/loans", async (_req, res): Promise<void> => {
  const loans = await db.select().from(loansTable).orderBy(loansTable.createdAt);
  res.json(loans.map(formatLoan));
});

router.post("/loans", async (req, res): Promise<void> => {
  const parsed = CreateLoanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { totalAmount, monthlyInstallment, remainingMonths, startDate, ...rest } = parsed.data;
  const calcRemaining = remainingMonths !== undefined ? remainingMonths : rest.months;
  const [loan] = await db
    .insert(loansTable)
    .values({
      ...rest,
      startDate: startDate.toISOString().slice(0, 10),
      totalAmount: String(totalAmount),
      monthlyInstallment: String(monthlyInstallment),
      remainingMonths: calcRemaining,
    })
    .returning();
  res.status(201).json(formatLoan(loan));
});

router.patch("/loans/:id", async (req, res): Promise<void> => {
  const params = UpdateLoanParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLoanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { totalAmount, monthlyInstallment, remainingMonths, startDate, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (startDate !== undefined) updateData.startDate = startDate.toISOString().slice(0, 10);
  if (totalAmount !== undefined) updateData.totalAmount = String(totalAmount);
  if (monthlyInstallment !== undefined) updateData.monthlyInstallment = String(monthlyInstallment);
  if (remainingMonths !== undefined) updateData.remainingMonths = remainingMonths;

  const [loan] = await db
    .update(loansTable)
    .set(updateData)
    .where(eq(loansTable.id, params.data.id))
    .returning();
  if (!loan) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }
  res.json(formatLoan(loan));
});

router.delete("/loans/:id", async (req, res): Promise<void> => {
  const params = DeleteLoanParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(loansTable).where(eq(loansTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
