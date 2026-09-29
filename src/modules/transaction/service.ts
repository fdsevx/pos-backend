import { eq, and, sql } from "drizzle-orm";
import Decimal from "decimal.js-light";
import {
  transactions,
  transaction_items,
  payments,
  products,
  stock_movements,
  outlets,
} from "../../db/schema";
import { createSaleJournal, createHppJournal } from "../../lib/journal";
import { generateReceiptNumber } from "../../lib/receipt-number";
import type { TransactionInput } from "./schema";

/**
 * Creates a full transaction within a single db.transaction:
 * 1. Insert transaction (onConflictDoNothing for idempotency)
 * 2. Insert transaction_items
 * 3. Insert payments
 * 4. Deduct stock atomically (stok = stok - qty)
 * 5. Create stock_movements (type: 'sale')
 * 6. Create sale journal (Dr Kas/QRIS, Cr Revenue, Cr Tax)
 * 7. Create HPP journal (Dr HPP, Cr Inventory)
 */
export async function createTransaction(
  db: any,
  outletId: string,
  outletSlug: string,
  cashierId: string,
  data: TransactionInput
): Promise<{ id: string; status: "accepted" | "duplicate" }> {
  return await db.transaction(async (tx: any) => {
    // Generate receipt number
    const receiptNumber = await generateReceiptNumber(
      tx,
      outletSlug,
      data.device_id,
      outletId
    );

    // Insert transaction with onConflictDoNothing for idempotency
    const [inserted] = await tx
      .insert(transactions)
      .values({
        id: data.id,
        outlet_id: outletId,
        device_id: data.device_id,
        receipt_number: receiptNumber,
        customer_id: data.customer_id ?? null,
        cashier_id: cashierId,
        shift_id: data.shift_id ?? null,
        table_number: data.table_number ?? null,
        subtotal: data.subtotal,
        discount_amount: data.discount_amount ?? "0",
        discount_id: data.discount_id ?? null,
        tax_amount: data.tax_amount ?? "0",
        service_amount: data.service_amount ?? "0",
        grand_total: data.grand_total,
        status: "PAID",
        notes: data.notes ?? null,
      })
      .onConflictDoNothing({ target: transactions.id })
      .returning();

    // If no row returned, it's a duplicate
    if (!inserted) {
      return { id: data.id, status: "duplicate" as const };
    }

    // Insert items
    const itemValues = data.items.map((item) => ({
      transaction_id: inserted.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_price_snapshot: item.cost_price_snapshot,
      discount_amount: item.discount_amount ?? "0",
      subtotal: item.subtotal,
    }));
    await tx.insert(transaction_items).values(itemValues);

    // Insert payments
    const paymentValues = data.payments.map((p) => ({
      transaction_id: inserted.id,
      method: p.method,
      amount: p.amount,
      amount_received: p.amount_received ?? null,
      change_amount: p.change_amount ?? "0",
      qris_reference: p.qris_reference ?? null,
    }));
    await tx.insert(payments).values(paymentValues);

    // Deduct stock atomically and create stock_movements
    for (const item of data.items) {
      // Atomic stock deduction: stok = stok - qty (negative allowed but flagged)
      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
          updated_at: new Date(),
        })
        .where(eq(products.id, item.product_id));

      await tx.insert(stock_movements).values({
        product_id: item.product_id,
        outlet_id: outletId,
        type: "sale",
        quantity: -item.quantity, // negative for sale
        reference_id: inserted.id,
        notes: `Sale: ${item.product_name} x${item.quantity}`,
        created_by: cashierId,
      });
    }

    // Create sale journal
    const revenueAmount = new Decimal(data.grand_total)
      .minus(new Decimal(data.tax_amount ?? "0"))
      .toFixed(2);

    await createSaleJournal(tx, {
      outletId,
      outletSlug,
      transactionId: inserted.id,
      cashierId,
      payments: data.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
      })),
      revenueAmount,
      taxAmount: data.tax_amount ?? "0",
    });

    // Create HPP journal
    let totalHpp = new Decimal(0);
    for (const item of data.items) {
      totalHpp = totalHpp.plus(
        new Decimal(item.cost_price_snapshot).times(item.quantity)
      );
    }

    await createHppJournal(tx, {
      outletId,
      outletSlug,
      transactionId: inserted.id,
      cashierId,
      totalHpp: totalHpp.toFixed(2),
    });

    return { id: inserted.id, status: "accepted" as const };
  });
}
