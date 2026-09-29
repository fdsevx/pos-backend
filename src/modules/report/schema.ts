import { z } from "zod";

export const monthlyQuerySchema = z.object({
  // Format: YYYY-MM
  month: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-MM"),
});

export const exportQuerySchema = z.object({
  from: z.string().optional(), // ISO date
  to: z.string().optional(),   // ISO date
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export type MonthlyQuery = z.infer<typeof monthlyQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
