import { eq, sql } from 'drizzle-orm';
import {
  purchases,
  purchase_items,
  products,
  stock_movements,
  pricing_history
} from '../../db/schema';
import { getCoaCodes, createJournalEntry } from '../../lib/journal';

export async function createPurchase(
  db: any,
  outletId: string,
  userId: string,
  outletSlug: string,
  data: any
) {
  return db.transaction(async (tx: any) => {
    // 1. Insert into purchases
    const [inserted] = await tx.insert(purchases).values({
      outlet_id: outletId,
      supplier_id: data.supplier_id,
      receipt_number: data.receipt_number,
      total_amount: data.total_amount.toString(),
      notes: data.notes,
      purchased_at: new Date(data.purchased_at),
      created_by: userId,
    }).returning();

    // 2 & 3. Process items
    for (const item of data.items) {
      await tx.insert(purchase_items).values({
        purchase_id: inserted.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost.toString(),
        subtotal: item.subtotal.toString(),
      });

      const [currentProduct] = await tx
        .select({
          stock: products.stock,
          cost_price: products.cost_price,
        })
        .from(products)
        .where(eq(products.id, item.product_id));

      if (currentProduct) {
        const currentStock = currentProduct.stock;
        const currentCost = parseFloat(currentProduct.cost_price);
        const qty = item.quantity;
        const unitCost = typeof item.unit_cost === 'string' ? parseFloat(item.unit_cost) : item.unit_cost;

        let newCost = unitCost;
        if (currentStock >= 0) {
          newCost = ((currentStock * currentCost) + (qty * unitCost)) / (currentStock + qty);
        }

        const newCostStr = newCost.toFixed(2);

        // Update product stock and cost_price
        await tx.update(products)
          .set({
            stock: sql`${products.stock} + ${qty}`,
            cost_price: newCostStr,
            updated_at: new Date()
          })
          .where(eq(products.id, item.product_id));

        // Insert pricing history if cost changes
        if (currentCost !== newCost) {
          await tx.insert(pricing_history).values({
            product_id: item.product_id,
            outlet_id: outletId,
            field_changed: 'cost_price',
            old_value: currentCost.toString(),
            new_value: newCostStr,
            changed_by: userId,
          });
        }

        // Insert stock movement
        await tx.insert(stock_movements).values({
          product_id: item.product_id,
          outlet_id: outletId,
          type: 'purchase',
          quantity: qty,
          reference_id: inserted.id,
          notes: `Purchase receipt: ${inserted.receipt_number || '-'}`,
          created_by: userId,
        });
      }
    }

    // 4. Create Journal
    const codes = getCoaCodes(outletSlug);
    await createJournalEntry(tx, {
      outletId,
      description: 'Pembelian barang',
      referenceType: 'purchase',
      referenceId: inserted.id,
      createdBy: userId,
      lines: [
        { accountCode: codes.inventory, debit: data.total_amount.toString(), credit: "0" },
        { accountCode: codes.cash, debit: "0", credit: data.total_amount.toString() }
      ]
    });

    return inserted;
  });
}
