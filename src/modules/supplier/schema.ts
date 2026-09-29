import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().optional().nullable(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
