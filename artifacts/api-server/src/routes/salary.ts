import { Router, type IRouter } from "express";
import { db, salaryTable } from "@workspace/db";
import { UpsertSalaryBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/salary", async (_req, res): Promise<void> => {
  const rows = await db.select().from(salaryTable).limit(1);
  if (!rows.length) {
    res.status(404).json({ error: "No salary configured" });
    return;
  }
  const s = rows[0];
  res.json({
    id: s.id,
    amount: parseFloat(s.amount),
    depositDay: s.depositDay,
    notes: s.notes ?? null,
    updatedAt: s.updatedAt.toISOString(),
  });
});

router.put("/salary", async (req, res): Promise<void> => {
  const parsed = UpsertSalaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(salaryTable).limit(1);

  let saved;
  if (existing.length) {
    const [updated] = await db
      .update(salaryTable)
      .set({
        amount: String(parsed.data.amount),
        depositDay: parsed.data.depositDay,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    saved = updated;
  } else {
    const [inserted] = await db
      .insert(salaryTable)
      .values({
        amount: String(parsed.data.amount),
        depositDay: parsed.data.depositDay,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    saved = inserted;
  }

  res.json({
    id: saved.id,
    amount: parseFloat(saved.amount),
    depositDay: saved.depositDay,
    notes: saved.notes ?? null,
    updatedAt: saved.updatedAt.toISOString(),
  });
});

export default router;
