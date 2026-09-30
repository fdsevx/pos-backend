import { z } from 'zod';

export const productSchema = z.object({
  outlet_id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().optional().nullable().or(z.literal('uuid_opsional')).or(z.literal('')).transform(v => (v === 'uuid_opsional' || v === '') ? null : v),
  sku: z.string().optional().default('').transform(v => (v && v.trim() !== '' ? v : `PRD-${Date.now().toString(36).toUpperCase()}`)),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  unit: z.string().min(1).default('pcs'),
  price: z.string().or(z.number()).transform(v => String(v)),
  cost_price: z.string().or(z.number()).transform(v => String(v)).optional().default('0'),
  stock: z.number().int().optional().default(0),
  track_stock: z.boolean().optional().default(true),
  is_available: z.boolean().optional().default(true),
  image_url: z.string().url().optional().nullable().or(z.literal('')),
});

export const opnameSchema = z.object({
  product_id: z.string().uuid(),
  actual_stock: z.number().int(),
  price: z.string().or(z.number()).transform(v => String(v)).optional(),
  cost_price: z.string().or(z.number()).transform(v => String(v)).optional(),
  notes: z.string().optional().nullable(),
});

export type ProductInput = z.infer<typeof productSchema>;
export type OpnameInput = z.infer<typeof opnameSchema>;
