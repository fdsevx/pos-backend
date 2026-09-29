import { z } from 'zod';

export const expenseSchema = z.object({
  category: z.string(),
  description: z.string().optional(),
  amount: z.string().or(z.number()).transform(v => String(v)),
  expense_date: z.string().optional().default(() => new Date().toISOString().slice(0, 10)),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
