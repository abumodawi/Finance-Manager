import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable, subcategoriesTable } from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryBody,
  DeleteCategoryParams,
  CreateSubcategoryBody,
  UpdateSubcategoryParams,
  UpdateSubcategoryBody,
  DeleteSubcategoryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getCategoryWithSubs(categoryId: number) {
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, categoryId));
  if (!category) return null;
  const subs = await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.categoryId, categoryId)).orderBy(subcategoriesTable.createdAt);
  return {
    id: category.id,
    name: category.name,
    emoji: category.emoji,
    subcategories: subs.map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name, emoji: s.emoji })),
  };
}

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.createdAt);
  const result = await Promise.all(categories.map((c) => getCategoryWithSubs(c.id)));
  res.json(result.filter(Boolean));
});

router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cat] = await db.insert(categoriesTable).values(parsed.data).returning();
  res.status(201).json({ id: cat.id, name: cat.name, emoji: cat.emoji, subcategories: [] });
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
  const [updated] = await db.update(categoriesTable).set(parsed.data).where(eq(categoriesTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const result = await getCategoryWithSubs(updated.id);
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
