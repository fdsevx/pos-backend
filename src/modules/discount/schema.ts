import { z } from 'zod';

export const discountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['percent', 'nominal']),
  value: z.string(),
  scope: z.enum(['product', 'transaction']),
  product_id: z.string().uuid().optional().nullable(),
  member_only: z.boolean().default(false),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
  is_active: z.boolean().default(true),
});

export type DiscountInput = z.infer<typeof discountSchema>;
