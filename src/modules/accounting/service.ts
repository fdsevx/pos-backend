import { eq, and, gte, lte, sql, like, inArray, lt } from 'drizzle-orm';
import { coa_accounts, journal_entries, journal_lines } from '../../db/schema';
import { createJournalEntry } from '../../lib/journal';
import Decimal from 'decimal.js-light';

// 1. COA CRUD
export async function getCOA(db: any, outletId: string) {
  return await db
    .select()
    .from(coa_accounts)
    .where(eq(coa_accounts.outlet_id, outletId))
    .orderBy(coa_accounts.code);
}

export async function createCOA(db: any, outletId: string, data: any) {
  const [inserted] = await db
    .insert(coa_accounts)
    .values({
      outlet_id: outletId,
      ...data
    })
    .returning();
  return inserted;
}

// 2. Manual Journal
export async function createManualJournal(db: any, outletId: string, userId: string, data: any) {
  return await db.transaction(async (tx: any) => {
    return await createJournalEntry(tx, {
      outletId,
      description: data.description,
      referenceType: 'manual',
      referenceId: 'MANUAL-' + Date.now(),
      createdBy: userId,
      lines: data.lines,
    });
  });
}

// 3. Lock Period
export async function lockPeriod(db: any, outletId: string, month: string) {
  const [updated] = await db
    .update(journal_entries)
    .set({ period_locked: true })
    .where(
      and(
        eq(journal_entries.outlet_id, outletId),
        like(sql`text(${journal_entries.entry_date})`, `${month}%`)
      )
    )
    .returning();
  return updated; // returns the first updated row, if any
}

// 4. Reports
export async function getGeneralLedger(db: any, outletId: string, from: string, to: string) {
  const lines = await db
    .select({
      account_code: coa_accounts.code,
      account_name: coa_accounts.name,
      entry_date: journal_entries.entry_date,
      description: journal_entries.description,
      reference: journal_entries.reference_id,
      debit: journal_lines.debit,
      credit: journal_lines.credit,
    })
    .from(journal_lines)
    .innerJoin(journal_entries, eq(journal_lines.journal_entry_id, journal_entries.id))
    .innerJoin(coa_accounts, eq(journal_lines.account_id, coa_accounts.id))
    .where(
      and(
        eq(journal_entries.outlet_id, outletId),
        gte(journal_entries.entry_date, from),
        lte(journal_entries.entry_date, to)
      )
    )
    .orderBy(coa_accounts.code, journal_entries.entry_date);

  return lines;
}

export async function getTrialBalance(db: any, outletId: string, from: string, to: string) {
  const rows = await db
    .select({
      account_code: coa_accounts.code,
      account_name: coa_accounts.name,
      type: coa_accounts.type,
      total_debit: sql<string>`sum(${journal_lines.debit})::text`,
      total_credit: sql<string>`sum(${journal_lines.credit})::text`,
    })
    .from(journal_lines)
    .innerJoin(journal_entries, eq(journal_lines.journal_entry_id, journal_entries.id))
    .innerJoin(coa_accounts, eq(journal_lines.account_id, coa_accounts.id))
    .where(
      and(
        eq(journal_entries.outlet_id, outletId),
        gte(journal_entries.entry_date, from),
        lte(journal_entries.entry_date, to)
      )
    )
    .groupBy(coa_accounts.code, coa_accounts.name, coa_accounts.type)
    .orderBy(coa_accounts.code);

  return rows;
}

export async function getIncomeStatement(db: any, outletId: string, from: string, to: string) {
  // Income Statement uses Revenue and Expense accounts
  const rows = await getTrialBalance(db, outletId, from, to);
  
  let totalRevenue = new Decimal(0);
  let totalExpense = new Decimal(0);
  
  const revenueAccounts = [];
  const expenseAccounts = [];

  for (const row of rows) {
    const debit = new Decimal(row.total_debit);
    const credit = new Decimal(row.total_credit);
    
    if (row.type === 'revenue') {
      const net = credit.minus(debit); // Revenue normal balance is credit
      totalRevenue = totalRevenue.plus(net);
      revenueAccounts.push({ ...row, net_balance: net.toFixed(2) });
    } else if (row.type === 'expense') {
      const net = debit.minus(credit); // Expense normal balance is debit
      totalExpense = totalExpense.plus(net);
      expenseAccounts.push({ ...row, net_balance: net.toFixed(2) });
    }
  }

  const netIncome = totalRevenue.minus(totalExpense);

  return {
    revenue: revenueAccounts,
    total_revenue: totalRevenue.toFixed(2),
    expense: expenseAccounts,
    total_expense: totalExpense.toFixed(2),
    net_income: netIncome.toFixed(2)
  };
}

export async function getBalanceSheet(db: any, outletId: string, asOfDate: string) {
  // Balance sheet uses ALL history up to `asOfDate`
  const rows = await db
    .select({
      account_code: coa_accounts.code,
      account_name: coa_accounts.name,
      type: coa_accounts.type,
      total_debit: sql<string>`sum(${journal_lines.debit})::text`,
      total_credit: sql<string>`sum(${journal_lines.credit})::text`,
    })
    .from(journal_lines)
    .innerJoin(journal_entries, eq(journal_lines.journal_entry_id, journal_entries.id))
    .innerJoin(coa_accounts, eq(journal_lines.account_id, coa_accounts.id))
    .where(
      and(
        eq(journal_entries.outlet_id, outletId),
        lte(journal_entries.entry_date, asOfDate) // From beginning of time up to asOfDate
      )
    )
    .groupBy(coa_accounts.code, coa_accounts.name, coa_accounts.type)
    .orderBy(coa_accounts.code);

  let totalAssets = new Decimal(0);
  let totalLiabilities = new Decimal(0);
  let totalEquity = new Decimal(0);
  let retainedEarnings = new Decimal(0); // Revenue - Expense

  const assets = [];
  const liabilities = [];
  const equity = [];

  for (const row of rows) {
    const debit = new Decimal(row.total_debit);
    const credit = new Decimal(row.total_credit);

    if (row.type === 'asset') {
      const net = debit.minus(credit);
      totalAssets = totalAssets.plus(net);
      assets.push({ ...row, net_balance: net.toFixed(2) });
    } else if (row.type === 'liability') {
      const net = credit.minus(debit);
      totalLiabilities = totalLiabilities.plus(net);
      liabilities.push({ ...row, net_balance: net.toFixed(2) });
    } else if (row.type === 'equity') {
      const net = credit.minus(debit);
      totalEquity = totalEquity.plus(net);
      equity.push({ ...row, net_balance: net.toFixed(2) });
    } else if (row.type === 'revenue') {
      const net = credit.minus(debit);
      retainedEarnings = retainedEarnings.plus(net);
    } else if (row.type === 'expense') {
      const net = debit.minus(credit);
      retainedEarnings = retainedEarnings.minus(net); // subtract expense from retained earnings
    }
  }

  // Add retained earnings to equity
  totalEquity = totalEquity.plus(retainedEarnings);
  equity.push({ 
    account_code: '3200', 
    account_name: 'Laba Ditahan (Retained Earnings)', 
    type: 'equity', 
    net_balance: retainedEarnings.toFixed(2) 
  });

  return {
    assets,
    total_assets: totalAssets.toFixed(2),
    liabilities,
    total_liabilities: totalLiabilities.toFixed(2),
    equity,
    total_equity: totalEquity.toFixed(2),
    total_liabilities_and_equity: totalLiabilities.plus(totalEquity).toFixed(2)
  };
}

export async function getCashFlow(db: any, outletId: string, from: string, to: string) {
  // Cash flow logic: Find journal entries that involve Cash accounts
  // Simplified: Net change in Cash accounts (Assets starting with 11)
  const cashLines = await db
    .select({
      account_code: coa_accounts.code,
      account_name: coa_accounts.name,
      total_debit: sql<string>`sum(${journal_lines.debit})::text`,
      total_credit: sql<string>`sum(${journal_lines.credit})::text`,
    })
    .from(journal_lines)
    .innerJoin(journal_entries, eq(journal_lines.journal_entry_id, journal_entries.id))
    .innerJoin(coa_accounts, eq(journal_lines.account_id, coa_accounts.id))
    .where(
      and(
        eq(journal_entries.outlet_id, outletId),
        gte(journal_entries.entry_date, from),
        lte(journal_entries.entry_date, to),
        like(coa_accounts.code, '11%') // Assuming 11xx are cash/bank accounts
      )
    )
    .groupBy(coa_accounts.code, coa_accounts.name);

  let netIncrease = new Decimal(0);
  const flows = [];

  for (const line of cashLines) {
    const debit = new Decimal(line.total_debit); // Inflow
    const credit = new Decimal(line.total_credit); // Outflow
    const net = debit.minus(credit);
    netIncrease = netIncrease.plus(net);
    flows.push({
      account: line.account_name,
      inflow: debit.toFixed(2),
      outflow: credit.toFixed(2),
      net_change: net.toFixed(2),
    });
  }

  return {
    flows,
    net_cash_increase: netIncrease.toFixed(2)
  };
}
