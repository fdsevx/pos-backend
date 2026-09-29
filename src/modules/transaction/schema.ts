import { z } from "zod";

const paymentItemSchema = z.object({
  method: z.string().transform((v) => {
    const upper = v.toUpperCase();
    if (upper === "CASH" || upper === "TUNAI") return "TUNAI" as const;
    return "QRIS" as const;
  }),
  amount: z.string().or(z.number()).transform((v) => String(v)),
  amount_received: z.string().or(z.number()).transform((v) => String(v)).optional(),
  change_amount: z.string().or(z.number()).transform((v) => String(v)).optional(),
  qris_reference: z.string().max(100).optional(),
});

const transactionItemSchema = z
  .object({
    product_id: z.string(),
    product_name: z.string().min(1).max(150).optional(),
    quantity: z.number().int().min(1),
    unit_price: z.string().or(z.number()).optional(),
    price: z.string().or(z.number()).optional(),
    cost_price_snapshot: z.string().or(z.number()).transform((v) => String(v)).optional().default("0"),
    discount_amount: z.string().or(z.number()).transform((v) => String(v)).optional().default("0"),
    subtotal: z.string().or(z.number()).optional(),
  })
  .transform((item) => {
    const finalPrice = String(item.unit_price ?? item.price ?? "0");
    const qty = item.quantity;
    const sub = item.subtotal !== undefined ? String(item.subtotal) : String(Number(finalPrice) * qty);
    return {
      ...item,
      unit_price: finalPrice,
      subtotal: sub,
    };
  });

export const transactionBaseSchema = z
  .object({
    id: z.string().optional(),
    device_id: z.string().optional().default("default-device"),
    customer_id: z.string().optional().nullable(),
    shift_id: z.string().uuid().optional().nullable(),
    table_number: z.string().max(10).optional().nullable(),
    subtotal: z.string().or(z.number()).optional(),
    discount_amount: z.string().or(z.number()).transform((v) => String(v)).optional().default("0"),
    discount_id: z.string().uuid().optional().nullable(),
    tax_amount: z.string().or(z.number()).transform((v) => String(v)).optional().default("0"),
    service_amount: z.string().or(z.number()).transform((v) => String(v)).optional().default("0"),
    grand_total: z.string().or(z.number()).optional(),
    payment_method: z.string().optional(),
    amount_paid: z.string().or(z.number()).transform((v) => String(v)).optional(),
    change_amount: z.string().or(z.number()).transform((v) => String(v)).optional(),
    notes: z.string().optional().nullable(),
    items: z.array(transactionItemSchema).min(1),
    payments: z.array(paymentItemSchema).optional(),
  });

export const transactionSchema = transactionBaseSchema.transform((data) => {
    const calcSubtotal = data.items.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
    const sub = data.subtotal !== undefined ? String(data.subtotal) : String(calcSubtotal);
    const disc = Number(data.discount_amount) || 0;
    const tax = Number(data.tax_amount) || 0;
    const srv = Number(data.service_amount) || 0;
    const grand = data.grand_total !== undefined ? String(data.grand_total) : String(Math.max(0, Number(sub) - disc + tax + srv));
    return {
      ...data,
      subtotal: sub,
      grand_total: grand,
    };
  });

export const voidTransactionSchema = z.object({
  reason: z.string().min(1),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;
