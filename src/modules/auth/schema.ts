import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
