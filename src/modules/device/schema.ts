import { z } from 'zod';

export const registerSchema = z.object({
  device_id: z.string().min(1, 'Device ID is required'),
  name: z.string().min(1, 'Name is required'),
  outlet_id: z.string().uuid('Invalid outlet ID'),
});

export const switchOutletSchema = z.object({
  outlet_id: z.string().uuid('Invalid outlet ID'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type SwitchOutletInput = z.infer<typeof switchOutletSchema>;
