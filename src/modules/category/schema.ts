import { z } from 'zod';

export const categorySchema = z.object({
  outlet_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  sort_order: z.number().int().default(0),
});

export type CategoryInput = z.infer<typeof categorySchema>;
