import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const salaryProcessingLogTable = pgTable("salary_processing_log", {
  id: serial("id").primaryKey(),
  processedMonth: text("processed_month").notNull().unique(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SalaryProcessingLog = typeof salaryProcessingLogTable.$inferSelect;
