import { z } from 'zod';

export const productSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  unit: z.string().min(1).default('pcs'),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  cost_price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  stock: z.number().int(),
  track_stock: z.boolean(),
  is_available: z.boolean(),
  image_url: z.string().url().optional().nullable(),
});

export const opnameSchema = z.object({
  product_id: z.string().uuid(),
  actual_stock: z.number().int(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  cost_price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  notes: z.string().optional().nullable(),
});

export type ProductInput = z.infer<typeof productSchema>;
export type OpnameInput = z.infer<typeof opnameSchema>;
