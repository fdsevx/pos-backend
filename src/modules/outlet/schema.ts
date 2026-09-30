import { z } from "zod";

export const updateSettingsSchema = z.object({
  tax_percent: z.string().or(z.number()).transform(v => String(v)).optional(),
  service_percent: z.string().or(z.number()).transform(v => String(v)).optional(),
  receipt_header: z.string().nullable().optional(),
  receipt_footer: z.string().nullable().optional(),
  payment_methods_enabled: z.array(z.string()).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  enable_table_number: z.boolean().optional(),
});

export const createOutletSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  is_active: z.boolean().default(true).optional(),
}).transform(val => {
  const generatedSlug = val.slug || val.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return {
    ...val,
    slug: generatedSlug.length >= 2 ? generatedSlug : `unit-${Date.now().toString(36)}`,
  };
});
