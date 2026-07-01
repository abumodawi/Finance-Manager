import { pgTable, serial, numeric, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const salaryTable = pgTable("salary", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  depositDay: integer("deposit_day").notNull(),
  accountId: integer("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSalarySchema = createInsertSchema(salaryTable).omit({ id: true, updatedAt: true });
export type InsertSalary = z.infer<typeof insertSalarySchema>;
export type Salary = typeof salaryTable.$inferSelect;
