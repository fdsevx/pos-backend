import { eq, and, gt, gte, isNull, isNotNull, sql, or } from "drizzle-orm";
import {
  products,
  categories,
  discounts,
  expenses,
  shifts,
  outlets,
} from "../../db/schema";
import { createTransaction } from "../transaction/service";
import type { SyncItem, PullQuery } from "./schema";

interface SyncResult {
  id: string;
  status: "accepted" | "duplicate" | "failed";
  error?: string;
}

/**
 * Process a single sync item. Each item runs in its own db.transaction.
 * One item failing does NOT affect others.
 */
export async function processSyncItem(
  db: any,
  outletId: string,
  outletSlug: string,
  cashierId: string,
  item: SyncItem
): Promise<SyncResult> {
  try {
    switch (item.type) {
      case "transaction": {
        const result = await createTransaction(
          db,
          outletId,
          outletSlug,
          cashierId,
          item as any
        );
        return { id: result.id, status: result.status };
      }

      case "expense": {
        const [inserted] = await db
          .insert(expenses)
          .values({
            id: item.id,
            outlet_id: outletId,
            category: item.category,
            description: item.description ?? null,
            amount: item.amount,
            expense_date: item.expense_date,
            created_by: cashierId,
          })
          .onConflictDoNothing({ target: expenses.id })
          .returning();

        return {
          id: item.id,
          status: inserted ? "accepted" : "duplicate",
        };
      }

      case "shift_open": {
        const [inserted] = await db
          .insert(shifts)
          .values({
            id: item.id,
            outlet_id: outletId,
            cashier_id: cashierId,
            device_id: item.device_id,
            cash_opening: item.cash_opening,
            opened_at: new Date(item.opened_at),
          })
          .onConflictDoNothing({ target: shifts.id })
          .returning();

        return {
          id: item.id,
          status: inserted ? "accepted" : "duplicate",
        };
      }

      case "shift_close": {
        // Delegate to shift close logic (simplified for sync)
        const [shift] = await db
          .select()
          .from(shifts)
          .where(
            and(
              eq(shifts.id, item.shift_id),
              eq(shifts.outlet_id, outletId),
              isNull(shifts.closed_at)
            )
          )
          .limit(1);

        if (!shift) {
          return {
            id: item.shift_id,
            status: "failed",
            error: "Shift not found or already closed",
          };
        }

        await db
          .update(shifts)
          .set({
            cash_closing: item.cash_closing,
            closed_at: new Date(),
            notes: item.notes ?? null,
          })
          .where(eq(shifts.id, item.shift_id));

        return { id: item.shift_id, status: "accepted" };
      }

      case "void": {
        try {
          // Import it directly or via transaction service
          const { voidTransaction } = await import("../transaction/service");
          const result = await voidTransaction(
            db,
            outletId,
            item.transaction_id!,
            cashierId,
            item.reason || "Voided via offline sync"
          );
          return {
            id: item.transaction_id!,
            status: "accepted",
          };
        } catch (err: any) {
          if (err.message.includes("already VOID")) {
            return { id: item.transaction_id!, status: "duplicate" };
          }
          throw err;
        }
      }

      default:
        return {
          id: "unknown",
          status: "failed",
          error: "Unknown sync item type",
        };
    }
  } catch (err: any) {
    const id =
      (item as any).id ??
      (item as any).transaction_id ??
      (item as any).shift_id ??
      "unknown";
    return {
      id,
      status: "failed",
      error: err.message,
    };
  }
}

/**
 * Pull data for Flutter sync.
 * Returns products, categories, discounts, plus tombstones (deleted_at).
 * Supports cursor-based pagination.
 */
export async function pullData(
  db: any,
  outletId: string,
  query: PullQuery
) {
  const limit = query.limit;
  const since = query.since ? new Date(query.since) : null;
  const isBootstrap = query.bootstrap;

  // Products
  const productFilter = isBootstrap
    ? eq(products.outlet_id, outletId)
    : and(
        eq(products.outlet_id, outletId),
        since
          ? gte(products.updated_at, since)
          : sql`true`
      );

  const productRows = await db
    .select()
    .from(products)
    .where(productFilter)
    .limit(limit + 1)
    .orderBy(products.updated_at);

  const hasMoreProducts = productRows.length > limit;
  const productData = productRows.slice(0, limit);

  // Categories
  const categoryFilter = isBootstrap
    ? eq(categories.outlet_id, outletId)
    : and(
        eq(categories.outlet_id, outletId),
        since
          ? gte(categories.updated_at, since)
          : sql`true`
      );

  const categoryRows = await db
    .select()
    .from(categories)
    .where(categoryFilter)
    .orderBy(categories.updated_at);

  // Discounts
  const discountFilter = isBootstrap
    ? eq(discounts.outlet_id, outletId)
    : and(
        eq(discounts.outlet_id, outletId),
        since
          ? gte(discounts.updated_at, since)
          : sql`true`
      );

  const discountRows = await db
    .select()
    .from(discounts)
    .where(discountFilter)
    .orderBy(discounts.updated_at);

  // Tombstones (soft-deleted items since last sync)
  const tombstones: { entity: string; id: string; deleted_at: Date }[] = [];
  if (since && !isBootstrap) {
    const deletedProducts = await db
      .select({ id: products.id, deleted_at: products.deleted_at })
      .from(products)
      .where(
        and(
          eq(products.outlet_id, outletId),
          isNotNull(products.deleted_at),
          gte(products.deleted_at, since)
        )
      );
    for (const p of deletedProducts) {
      tombstones.push({ entity: "product", id: p.id, deleted_at: p.deleted_at });
    }

    const deletedCategories = await db
      .select({ id: categories.id, deleted_at: categories.deleted_at })
      .from(categories)
      .where(
        and(
          eq(categories.outlet_id, outletId),
          isNotNull(categories.deleted_at),
          gte(categories.deleted_at, since)
        )
      );
    for (const c of deletedCategories) {
      tombstones.push({ entity: "category", id: c.id, deleted_at: c.deleted_at });
    }

    const deletedDiscounts = await db
      .select({ id: discounts.id, deleted_at: discounts.deleted_at })
      .from(discounts)
      .where(
        and(
          eq(discounts.outlet_id, outletId),
          isNotNull(discounts.deleted_at),
          gte(discounts.deleted_at, since)
        )
      );
    for (const d of deletedDiscounts) {
      tombstones.push({ entity: "discount", id: d.id, deleted_at: d.deleted_at });
    }
  }

  // Cursor for next page (use last product's updated_at)
  const nextCursor =
    hasMoreProducts && productData.length > 0
      ? productData[productData.length - 1].updated_at.toISOString()
      : null;

  return {
    products: productData,
    categories: categoryRows,
    discounts: discountRows,
    tombstones,
    next_cursor: nextCursor,
    has_more: hasMoreProducts,
  };
}
