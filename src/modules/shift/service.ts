import { eq, and, isNull, sql } from "drizzle-orm";
import Decimal from "decimal.js-light";
import { shifts, payments, transactions } from "../../db/schema";
import { createJournalEntry, getCoaCodes } from "../../lib/journal";
import type { OpenShiftInput, CloseShiftInput } from "./schema";

export async function openShift(
  db: any,
  outletId: string,
  cashierId: string,
  data: OpenShiftInput
) {
  // Check for already-open shift on this device
  const [existing] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(
      and(
        eq(shifts.outlet_id, outletId),
        eq(shifts.device_id, data.device_id),
        isNull(shifts.closed_at)
      )
    )
    .limit(1);

  if (existing) {
    throw new Error("A shift is already open on this device");
  }

  const [shift] = await db
    .insert(shifts)
    .values({
      outlet_id: outletId,
      cashier_id: cashierId,
      device_id: data.device_id,
      cash_opening: data.cash_opening,
      opened_at: new Date(),
    })
    .returning();

  return shift;
}

export async function closeShift(
  db: any,
  outletId: string,
  outletSlug: string,
  cashierId: string,
  data: CloseShiftInput
) {
  return await db.transaction(async (tx: any) => {
    // Get shift
    const [shift] = await tx
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.id, data.shift_id),
          eq(shifts.outlet_id, outletId),
          isNull(shifts.closed_at)
        )
      )
      .limit(1);

    if (!shift) {
      throw new Error("Shift not found or already closed");
    }

    // Calculate expected cash:
    // cash_opening + sum of TUNAI payments in transactions during this shift
    const [cashResult] = await tx
      .select({
        total: sql<string>`coalesce(sum(${payments.amount}), '0')`,
      })
      .from(payments)
      .innerJoin(transactions, eq(payments.transaction_id, transactions.id))
      .where(
        and(
          eq(transactions.shift_id, shift.id),
          eq(transactions.outlet_id, outletId),
          eq(transactions.status, "PAID"),
          eq(payments.method, "TUNAI")
        )
      );

    const cashSales = new Decimal(cashResult?.total ?? "0");
    const expectedCash = new Decimal(shift.cash_opening).plus(cashSales);
    const actualCash = new Decimal(data.cash_closing);
    const difference = actualCash.minus(expectedCash);

    const [updated] = await tx
      .update(shifts)
      .set({
        cash_closing: data.cash_closing,
        expected_cash: expectedCash.toFixed(2),
        cash_difference: difference.toFixed(2),
        closed_at: new Date(),
        notes: data.notes ?? null,
      })
      .where(eq(shifts.id, shift.id))
      .returning();

    // If there's a cash difference, create 6900 Selisih Kas journal
    if (!difference.isZero()) {
      const codes = getCoaCodes(outletSlug);
      const absDiff = difference.abs().toFixed(2);

      if (difference.greaterThan(0)) {
        // Surplus: Dr Kas, Cr Selisih Kas
        await createJournalEntry(tx, {
          outletId,
          description: `Selisih kas shift #${shift.id.slice(0, 8)} (surplus)`,
          referenceType: "shift",
          referenceId: shift.id,
          createdBy: cashierId,
          lines: [
            { accountCode: codes.cash, debit: absDiff, credit: "0" },
            { accountCode: "6900", debit: "0", credit: absDiff },
          ],
        });
      } else {
        // Deficit: Dr Selisih Kas, Cr Kas
        await createJournalEntry(tx, {
          outletId,
          description: `Selisih kas shift #${shift.id.slice(0, 8)} (defisit)`,
          referenceType: "shift",
          referenceId: shift.id,
          createdBy: cashierId,
          lines: [
            { accountCode: "6900", debit: absDiff, credit: "0" },
            { accountCode: codes.cash, debit: "0", credit: absDiff },
          ],
        });
      }
    }

    return updated;
  });
}
