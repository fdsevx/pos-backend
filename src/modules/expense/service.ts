import { eq } from 'drizzle-orm';
import { expenses } from '../../db/schema';
import { getCoaCodes, createJournalEntry } from '../../lib/journal';
import { ExpenseInput } from './schema';

export async function getExpenses(db: any, outletId: string) {
  return db.query.expenses.findMany({
    where: eq(expenses.outlet_id, outletId),
    orderBy: (exp: any, { desc }: any) => [desc(exp.expense_date)],
  });
}

export async function createExpense(
  db: any,
  outletId: string,
  outletSlug: string,
  userId: string,
  data: ExpenseInput
) {
  return db.transaction(async (tx: any) => {
    const [inserted] = await tx.insert(expenses).values({
      outlet_id: outletId,
      created_by: userId,
      category: data.category,
      description: data.description,
      amount: data.amount,
      expense_date: data.expense_date,
    }).returning();

    const codes = getCoaCodes(outletSlug);
    await createJournalEntry(tx, {
      outletId,
      description: data.description || 'Pengeluaran',
      referenceType: 'expense',
      referenceId: inserted.id,
      createdBy: userId,
      lines: [
        { accountCode: codes.expense, debit: data.amount, credit: "0" },
        { accountCode: codes.cash, debit: "0", credit: data.amount }
      ]
    });

    return inserted;
  });
}
