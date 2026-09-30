import { eq, and, isNull, inArray } from 'drizzle-orm';
import { categories } from '../../db/schema';
import type { CategoryInput } from './schema';

export const listCategories = async (db: any, outletId: string) => {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.outlet_id, outletId), isNull(categories.deleted_at)))
    .orderBy(categories.sort_order);
};

export const listAllCategories = async (db: any, allowedOutletIds?: string[] | null) => {
  if (allowedOutletIds && allowedOutletIds.length === 0) return [];
  if (allowedOutletIds && allowedOutletIds.length > 0) {
    return db
      .select()
      .from(categories)
      .where(and(inArray(categories.outlet_id, allowedOutletIds), isNull(categories.deleted_at)))
      .orderBy(categories.sort_order);
  }
  return db
    .select()
    .from(categories)
    .where(isNull(categories.deleted_at))
    .orderBy(categories.sort_order);
};

export const createCategory = async (db: any, outletId: string, data: CategoryInput) => {
  const [newCategory] = await db
    .insert(categories)
    .values({
      outlet_id: outletId,
      ...data,
    })
    .returning();
  return newCategory;
};

export const updateCategory = async (db: any, outletId: string, id: string, data: Partial<CategoryInput>) => {
  const whereClause =
    outletId === 'ALL'
      ? and(eq(categories.id, id), isNull(categories.deleted_at))
      : and(eq(categories.id, id), eq(categories.outlet_id, outletId), isNull(categories.deleted_at));

  const [updatedCategory] = await db
    .update(categories)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(whereClause)
    .returning();
  return updatedCategory;
};

export const deleteCategory = async (db: any, outletId: string, id: string) => {
  const whereClause =
    outletId === 'ALL'
      ? eq(categories.id, id)
      : and(eq(categories.id, id), eq(categories.outlet_id, outletId));

  const [deletedCategory] = await db
    .update(categories)
    .set({
      deleted_at: new Date(),
    })
    .where(whereClause)
    .returning();
  return deletedCategory;
};
