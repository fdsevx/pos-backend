import { z } from 'zod';

export const expenseSchema = z.object({
  category: z.string(),
  description: z.string().optional(),
  amount: z.string(), // numeric string
  expense_date: z.string(), // YYYY-MM-DD
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
