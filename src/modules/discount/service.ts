import { eq, and, isNull } from 'drizzle-orm';
import { discounts } from '../../db/schema';
import { DiscountInput } from './schema';

export class DiscountService {
  async getDiscounts(db: any, outletId: string) {
    return await db.select()
      .from(discounts)
      .where(and(eq(discounts.outlet_id, outletId), isNull(discounts.deleted_at)));
  }

  async getDiscount(db: any, id: string, outletId: string) {
    const results = await db.select()
      .from(discounts)
      .where(and(eq(discounts.id, id), eq(discounts.outlet_id, outletId), isNull(discounts.deleted_at)))
      .limit(1);
    return results[0] || null;
  }

  async createDiscount(db: any, outletId: string, data: DiscountInput) {
    const insertData: any = {
      outlet_id: outletId,
      ...data,
      start_date: data.start_date ? new Date(data.start_date) : null,
      end_date: data.end_date ? new Date(data.end_date) : null,
    };
    
    if (data.start_date === undefined) delete insertData.start_date;
    if (data.end_date === undefined) delete insertData.end_date;

    const results = await db.insert(discounts)
      .values(insertData)
      .returning();
    return results[0];
  }

  async updateDiscount(db: any, id: string, outletId: string, data: Partial<DiscountInput>) {
    const updateData: any = { ...data, updated_at: new Date() };
    if (data.start_date) updateData.start_date = new Date(data.start_date);
    if (data.end_date) updateData.end_date = new Date(data.end_date);

    const results = await db.update(discounts)
      .set(updateData)
      .where(and(eq(discounts.id, id), eq(discounts.outlet_id, outletId), isNull(discounts.deleted_at)))
      .returning();
    return results[0] || null;
  }

  async deleteDiscount(db: any, id: string, outletId: string) {
    const results = await db.update(discounts)
      .set({ deleted_at: new Date() })
      .where(and(eq(discounts.id, id), eq(discounts.outlet_id, outletId), isNull(discounts.deleted_at)))
      .returning();
    return results[0] || null;
  }
}

export const discountService = new DiscountService();
