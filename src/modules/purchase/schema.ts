import { z } from 'zod';

export const purchaseItemSchema = z
  .object({
    product_id: z.string(),
    quantity: z.number().int().positive(),
    cost_price: z.string().or(z.number()).optional(),
    unit_cost: z.string().or(z.number()).optional(),
    subtotal: z.string().or(z.number()).optional(),
  })
  .transform((item) => {
    const cost = String(item.cost_price ?? item.unit_cost ?? "0");
    const qty = item.quantity;
    const sub = item.subtotal !== undefined ? String(item.subtotal) : String(Number(cost) * qty);
    return {
      ...item,
      unit_cost: cost,
      subtotal: sub,
    };
  });

export const purchaseSchema = z
  .object({
    supplier_id: z.string().uuid().optional().nullable(),
    supplier_name: z.string().optional().nullable(),
    receipt_number: z.string().max(50).optional(),
    total_amount: z.string().or(z.number()).optional(),
    notes: z.string().optional(),
    purchased_at: z.string().or(z.date()).optional(),
    items: z.array(purchaseItemSchema).min(1),
  })
  .transform((data) => {
    const total = data.total_amount
      ? String(data.total_amount)
      : String(data.items.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0));
    const purchasedAt = data.purchased_at ? new Date(data.purchased_at).toISOString() : new Date().toISOString();
    return {
      ...data,
      total_amount: total,
      purchased_at: purchasedAt,
      notes: data.notes || (data.supplier_name ? `Supplier: ${data.supplier_name}` : undefined),
    };
  });

export type PurchaseDTO = z.infer<typeof purchaseSchema>;
