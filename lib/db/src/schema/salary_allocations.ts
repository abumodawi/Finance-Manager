import { pgTable, serial, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const salaryAllocationsTable = pgTable("salary_allocations", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("0"),
});

export const insertSalaryAllocationSchema = createInsertSchema(salaryAllocationsTable).omit({ id: true });
export type InsertSalaryAllocation = z.infer<typeof insertSalaryAllocationSchema>;
export type SalaryAllocation = typeof salaryAllocationsTable.$inferSelect;
