import { z } from "zod";
import { transactionSchema } from "../transaction/schema";

const syncExpenseSchema = z.object({
  type: z.literal("expense"),
  id: z.string().uuid(),
  category: z.string().min(1).max(50),
  description: z.string().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  expense_date: z.string(), // YYYY-MM-DD
});

const syncTransactionSchema = z.object({
  type: z.literal("transaction"),
}).merge(transactionSchema);

const syncShiftOpenSchema = z.object({
  type: z.literal("shift_open"),
  id: z.string().uuid(),
  device_id: z.string().min(1),
  cash_opening: z.string().regex(/^\d+(\.\d{1,2})?$/),
  opened_at: z.string(), // ISO timestamp
});

const syncShiftCloseSchema = z.object({
  type: z.literal("shift_close"),
  shift_id: z.string().uuid(),
  cash_closing: z.string().regex(/^\d+(\.\d{1,2})?$/),
  notes: z.string().optional(),
});

const syncVoidSchema = z.object({
  type: z.literal("void"),
  transaction_id: z.string().uuid(),
  reason: z.string().min(1),
});

export const syncItemSchema = z.discriminatedUnion("type", [
  syncTransactionSchema,
  syncExpenseSchema,
  syncShiftOpenSchema,
  syncShiftCloseSchema,
  syncVoidSchema,
]);

export const syncBatchSchema = z.object({
  items: z.array(syncItemSchema).min(1).max(25),
});

export const pullQuerySchema = z.object({
  since: z.string().optional(), // ISO timestamp
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  bootstrap: z.coerce.boolean().default(false),
});

export type SyncItem = z.infer<typeof syncItemSchema>;
export type SyncBatch = z.infer<typeof syncBatchSchema>;
export type PullQuery = z.infer<typeof pullQuerySchema>;
