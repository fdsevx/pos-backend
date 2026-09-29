import { z } from "zod";

export const coaSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
});

export const manualJournalSchema = z.object({
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  lines: z.array(
    z.object({
      accountCode: z.string().min(1),
      debit: z.string().regex(/^\d+(\.\d{1,2})?$/),
      credit: z.string().regex(/^\d+(\.\d{1,2})?$/),
    })
  ).min(2)
});

export const lockPeriodSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
});

export const reportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
