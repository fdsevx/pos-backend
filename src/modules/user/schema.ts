import { z } from "zod";

export const userCreateSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  display_name: z.string().min(1).max(100),
  role: z.enum(["super_admin", "admin", "manager", "cashier", "accountant", "kitchen"]),
  outlet_ids: z.array(z.string().uuid()).optional(),
  permissions: z.array(z.string()).optional(),
});

export const userUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  role: z.enum(["super_admin", "admin", "manager", "cashier", "accountant", "kitchen"]).optional(),
  is_active: z.boolean().optional(),
  outlet_ids: z.array(z.string().uuid()).optional(),
  permissions: z.array(z.string()).optional(),
});

export const resetPasswordSchema = z.object({
  new_password: z.string().min(6),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
