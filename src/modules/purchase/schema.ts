import { z } from 'zod';

export const purchaseSchema = z.object({
  supplier_id: z.string().uuid().optional(),
  receipt_number: z.string().max(50).optional(),
  total_amount: z.string().or(z.number()),
  notes: z.string().optional(),
  purchased_at: z.string().datetime().or(z.date()),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().positive(),
      unit_cost: z.string().or(z.number()),
      subtotal: z.string().or(z.number()),
    })
  ).min(1),
});

export type PurchaseDTO = z.infer<typeof purchaseSchema>;
