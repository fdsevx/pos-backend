import { eq, and, isNull, desc } from 'drizzle-orm';
import { customers, transactions } from '../../db/schema';
import type { CustomerInput } from './schema';

export async function getCustomers(db: any, outletId: string) {
  return await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.outlet_id, outletId),
        isNull(customers.deleted_at)
      )
    )
    .orderBy(desc(customers.created_at));
}

export async function createCustomer(db: any, outletId: string, data: CustomerInput) {
  const [inserted] = await db
    .insert(customers)
    .values({
      outlet_id: outletId,
      name: data.name,
      phone: data.phone || null,
      member_type: data.member_type || 'regular',
    })
    .returning();
  return inserted;
}

export async function updateCustomer(db: any, outletId: string, id: string, data: Partial<CustomerInput>) {
  const [updated] = await db
    .update(customers)
    .set({
      ...data,
      updated_at: new Date()
    })
    .where(
      and(
        eq(customers.id, id),
        eq(customers.outlet_id, outletId)
      )
    )
    .returning();
  
  if (!updated) throw new Error("Customer not found");
  return updated;
}

export async function deleteCustomer(db: any, outletId: string, id: string) {
  const [deleted] = await db
    .update(customers)
    .set({ deleted_at: new Date() })
    .where(
      and(
        eq(customers.id, id),
        eq(customers.outlet_id, outletId)
      )
    )
    .returning();

  if (!deleted) throw new Error("Customer not found");
  return deleted;
}

export async function getCustomerHistory(db: any, outletId: string, id: string) {
  // Return last 50 transactions for this customer
  return await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.customer_id, id),
        eq(transactions.outlet_id, outletId)
      )
    )
    .orderBy(desc(transactions.created_at))
    .limit(50);
}
