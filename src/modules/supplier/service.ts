import { eq, and, isNull } from 'drizzle-orm';
import { suppliers } from '../../db/schema';
import type { SupplierInput } from './schema';

export const listSuppliers = async (db: any, outletId: string) => {
  return db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.outlet_id, outletId), isNull(suppliers.deleted_at)));
};

export const createSupplier = async (db: any, outletId: string, data: SupplierInput) => {
  const [newSupplier] = await db
    .insert(suppliers)
    .values({
      outlet_id: outletId,
      ...data,
    })
    .returning();
  return newSupplier;
};

export const updateSupplier = async (db: any, outletId: string, id: string, data: Partial<SupplierInput>) => {
  const [updatedSupplier] = await db
    .update(suppliers)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(and(eq(suppliers.id, id), eq(suppliers.outlet_id, outletId), isNull(suppliers.deleted_at)))
    .returning();
  return updatedSupplier;
};

export const deleteSupplier = async (db: any, outletId: string, id: string) => {
  const [deletedSupplier] = await db
    .update(suppliers)
    .set({
      deleted_at: new Date(),
    })
    .where(and(eq(suppliers.id, id), eq(suppliers.outlet_id, outletId), isNull(suppliers.deleted_at)))
    .returning();
  return deletedSupplier;
};
