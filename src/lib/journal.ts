import Decimal from "decimal.js-light";
import { eq } from "drizzle-orm";
import {
  coa_accounts,
  journal_entries,
  journal_lines,
} from "../db/schema";

/**
 * COA code mapping per outlet slug.
 * Restoran: 1111 Kas, 1112 QRIS, 1201 Stok, 4100 Penjualan, 5100 HPP
 * Cafe:     1121 Kas, 1122 QRIS, 1202 Stok, 4200 Penjualan, 5200 HPP
 * Shared:   2100 Utang Pajak
 */
export function getCoaCodes(outletSlug: string) {
  if (outletSlug === "restoran") {
    return {
      cash: "1111",
      qris: "1112",
      inventory: "1201",
      revenue: "4100",
      hpp: "5100",
      expense: "6100",
    };
  }
  return {
    cash: "1121",
    qris: "1122",
    inventory: "1202",
    revenue: "4200",
    hpp: "5200",
    expense: "6200",
  };
}

const TAX_ACCOUNT_CODE = "2100";

/** Resolve COA account id by code. Cached per transaction. */
async function resolveAccountId(
  tx: any,
  code: string,
  cache: Map<string, string>
): Promise<string> {
  if (cache.has(code)) return cache.get(code)!;
  const [row] = await tx
    .select({ id: coa_accounts.id })
    .from(coa_accounts)
    .where(eq(coa_accounts.code, code))
    .limit(1);
  if (!row) throw new Error(`COA account not found: ${code}`);
  cache.set(code, row.id);
  return row.id;
}

interface JournalLine {
  accountCode: string;
  debit: string; // numeric string
  credit: string;
}

/**
 * Creates a journal entry with lines inside an existing db transaction.
 * Validates debit == credit before insert; throws on imbalance.
 */
export async function createJournalEntry(
  tx: any,
  data: {
    outletId: string;
    description: string;
    referenceType: string;
    referenceId: string;
    createdBy: string;
    lines: JournalLine[];
  }
) {
  // Validate balance
  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);
  for (const line of data.lines) {
    totalDebit = totalDebit.plus(new Decimal(line.debit));
    totalCredit = totalCredit.plus(new Decimal(line.credit));
  }
  if (!totalDebit.equals(totalCredit)) {
    throw new Error(
      `Journal imbalance: debit=${totalDebit.toString()} credit=${totalCredit.toString()}`
    );
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [entry] = await tx
    .insert(journal_entries)
    .values({
      outlet_id: data.outletId,
      entry_date: today,
      description: data.description,
      reference_type: data.referenceType,
      reference_id: data.referenceId,
      created_by: data.createdBy,
    })
    .returning();

  const cache = new Map<string, string>();
  const lineValues = [];
  for (const line of data.lines) {
    const accountId = await resolveAccountId(tx, line.accountCode, cache);
    lineValues.push({
      journal_entry_id: entry.id,
      account_id: accountId,
      debit: line.debit,
      credit: line.credit,
    });
  }

  await tx.insert(journal_lines).values(lineValues);

  return entry;
}

/**
 * Creates the sale journal for a transaction.
 * Dr Kas/QRIS (per payment), Cr Pendapatan, Cr Utang Pajak (if tax > 0)
 */
export async function createSaleJournal(
  tx: any,
  opts: {
    outletId: string;
    outletSlug: string;
    transactionId: string;
    cashierId: string;
    payments: { method: string; amount: string }[];
    revenueAmount: string; // grand_total - tax_amount
    taxAmount: string;
  }
) {
  const codes = getCoaCodes(opts.outletSlug);
  const lines: JournalLine[] = [];

  // Debit: Kas and/or QRIS per payment
  for (const p of opts.payments) {
    const code = p.method === "TUNAI" ? codes.cash : codes.qris;
    lines.push({ accountCode: code, debit: p.amount, credit: "0" });
  }

  // Credit: Revenue
  lines.push({
    accountCode: codes.revenue,
    debit: "0",
    credit: opts.revenueAmount,
  });

  // Credit: Tax if any
  const taxDec = new Decimal(opts.taxAmount);
  if (taxDec.greaterThan(0)) {
    lines.push({
      accountCode: TAX_ACCOUNT_CODE,
      debit: "0",
      credit: opts.taxAmount,
    });
  }

  return createJournalEntry(tx, {
    outletId: opts.outletId,
    description: `Penjualan #${opts.transactionId.slice(0, 8)}`,
    referenceType: "transaction",
    referenceId: opts.transactionId,
    createdBy: opts.cashierId,
    lines,
  });
}

/**
 * Creates the HPP (Cost of Goods Sold) journal for a transaction.
 * Dr HPP, Cr Persediaan
 */
export async function createHppJournal(
  tx: any,
  opts: {
    outletId: string;
    outletSlug: string;
    transactionId: string;
    cashierId: string;
    totalHpp: string; // sum of (cost_price_snapshot * qty) for all items
  }
) {
  const hppDec = new Decimal(opts.totalHpp);
  if (hppDec.isZero()) return null; // no HPP to record

  const codes = getCoaCodes(opts.outletSlug);

  return createJournalEntry(tx, {
    outletId: opts.outletId,
    description: `HPP Penjualan #${opts.transactionId.slice(0, 8)}`,
    referenceType: "transaction",
    referenceId: opts.transactionId,
    createdBy: opts.cashierId,
    lines: [
      { accountCode: codes.hpp, debit: opts.totalHpp, credit: "0" },
      { accountCode: codes.inventory, debit: "0", credit: opts.totalHpp },
    ],
  });
}
