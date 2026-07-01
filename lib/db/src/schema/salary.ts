import { pgTable, serial, numeric, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salaryTable = pgTable("salary", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  depositDay: integer("deposit_day").notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalarySchema = createInsertSchema(salaryTable).omit({ id: true, updatedAt: true });
export type InsertSalary = z.infer<typeof insertSalarySchema>;
export type Salary = typeof salaryTable.$inferSelect;
