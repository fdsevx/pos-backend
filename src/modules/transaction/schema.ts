import { z } from "zod";

const paymentItemSchema = z.object({
  method: z.enum(["TUNAI", "QRIS"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  amount_received: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  change_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  qris_reference: z.string().max(100).optional(),
});

const transactionItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1).max(150),
  quantity: z.number().int().min(1),
  unit_price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  cost_price_snapshot: z.string().regex(/^\d+(\.\d{1,2})?$/),
  discount_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const transactionSchema = z.object({
  id: z.string().uuid(), // Flutter-generated ID for idempotency
  device_id: z.string().min(1),
  customer_id: z.string().uuid().optional(),
  shift_id: z.string().uuid().optional(),
  table_number: z.string().max(10).optional(),
  subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/),
  discount_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  discount_id: z.string().uuid().optional(),
  tax_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  service_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  grand_total: z.string().regex(/^\d+(\.\d{1,2})?$/),
  notes: z.string().optional(),
  items: z.array(transactionItemSchema).min(1),
  payments: z.array(paymentItemSchema).min(1),
});

export const voidTransactionSchema = z.object({
  reason: z.string().min(1),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;
