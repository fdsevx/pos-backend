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
import { createSaleJournal, createHppJournal, reverseJournals } from "../../lib/journal";
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
    const txId = data.id || crypto.randomUUID();
    const isUuid = (id?: string | null) =>
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const validCustomerId = isUuid(data.customer_id) ? data.customer_id : null;

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
        id: txId,
        outlet_id: outletId,
        device_id: data.device_id,
        receipt_number: receiptNumber,
        customer_id: validCustomerId,
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
      return { id: txId, status: "duplicate" as const };
    }

    // Resolve product names if missing
    for (const item of data.items) {
      if (!item.product_name) {
        const [prod] = await tx
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, item.product_id))
          .limit(1);
        item.product_name = prod?.name || `Produk ${item.product_id.slice(0, 8)}`;
      }
    }

    // Insert items
    const itemValues = data.items.map((item) => ({
      transaction_id: inserted.id,
      product_id: item.product_id,
      product_name: item.product_name!,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_price_snapshot: item.cost_price_snapshot,
      discount_amount: item.discount_amount ?? "0",
      subtotal: item.subtotal,
    }));
    await tx.insert(transaction_items).values(itemValues);

    // Prepare & insert payments
    let paymentValues: any[] = [];
    if (data.payments && data.payments.length > 0) {
      paymentValues = data.payments.map((p) => ({
        transaction_id: inserted.id,
        method: p.method,
        amount: p.amount,
        amount_received: p.amount_received ?? null,
        change_amount: p.change_amount ?? "0",
        qris_reference: p.qris_reference ?? null,
      }));
    } else {
      const isQris =
        data.payment_method?.toUpperCase() === "QRIS" ||
        data.payment_method?.toLowerCase().includes("qris");
      paymentValues = [
        {
          transaction_id: inserted.id,
          method: isQris ? ("QRIS" as const) : ("TUNAI" as const),
          amount: data.grand_total,
          amount_received: data.amount_paid ?? data.grand_total,
          change_amount: data.change_amount ?? "0",
          qris_reference: null,
        },
      ];
    }
    await tx.insert(payments).values(paymentValues);

    // Deduct stock atomically and create stock_movements
    for (const item of data.items) {
      // Atomic stock deduction: stok = stok - qty
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
      payments: paymentValues.map((p) => ({
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

    // CRM: Update Customer spending and points
    if (data.customer_id) {
      const { customers } = await import('../../db/schema');
      const earnedPoints = Math.floor(parseFloat(data.grand_total) / 10000); // 1 point per 10.000
      await tx
        .update(customers)
        .set({
          total_spending: sql`${customers.total_spending} + ${data.grand_total}`,
          points: sql`${customers.points} + ${earnedPoints}`,
          updated_at: new Date()
        })
        .where(eq(customers.id, data.customer_id));
    }

    return { id: inserted.id, status: "accepted" as const };
  });
}

export async function voidTransaction(
  db: any,
  outletId: string,
  transactionId: string,
  userId: string,
  reason: string
) {
  return await db.transaction(async (tx: any) => {
    const [transaction] = await tx
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.id, transactionId), eq(transactions.outlet_id, outletId))
      )
      .limit(1);

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status === "VOID" || transaction.status === "REFUNDED") {
      throw new Error(`Transaction is already ${transaction.status}`);
    }

    await tx
      .update(transactions)
      .set({
        status: "VOID",
        voided_at: new Date(),
        voided_by: userId,
        void_reason: reason,
      })
      .where(eq(transactions.id, transactionId));

    const items = await tx
      .select()
      .from(transaction_items)
      .where(eq(transaction_items.transaction_id, transactionId));

    for (const item of items) {
      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} + ${item.quantity}`,
          updated_at: new Date(),
        })
        .where(eq(products.id, item.product_id));

      await tx.insert(stock_movements).values({
        product_id: item.product_id,
        outlet_id: outletId,
        type: "void",
        quantity: item.quantity,
        reference_id: transactionId,
        notes: `Void: ${item.product_name} x${item.quantity} - ${reason}`,
        created_by: userId,
      });
    }

    await reverseJournals(tx, "transaction", transactionId, userId, reason);

    return { id: transactionId, status: "VOID" };
  });
}
