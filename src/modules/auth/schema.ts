import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1).max(50).optional(),
  email: z.string().min(1).max(50).optional(),
  password: z.string().min(1),
}).refine(data => data.username || data.email, {
  message: "Either username or email must be provided",
  path: ["username"]
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  display_name: z.string().min(1).max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
