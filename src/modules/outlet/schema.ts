import { z } from "zod";

export const updateSettingsSchema = z.object({
  tax_percent: z.string().optional(),
  service_percent: z.string().optional(),
  receipt_header: z.string().nullable().optional(),
  receipt_footer: z.string().nullable().optional(),
  payment_methods_enabled: z.array(z.string()).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  enable_table_number: z.boolean().optional(),
});
