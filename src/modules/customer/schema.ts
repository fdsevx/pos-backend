import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1).max(150),
  phone: z.string().max(20).optional().nullable(),
  member_type: z.string().max(20).optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
