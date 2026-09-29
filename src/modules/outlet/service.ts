import { inArray, eq } from "drizzle-orm";
import { outlets } from "../../db/schema";
export const getOutlets = async (db: any, userOutletIds: string[]) => {
  if (!userOutletIds || userOutletIds.length === 0) return [];
  return await db
    .select({
      id: outlets.id,
      name: outlets.name,
      slug: outlets.slug,
      is_active: outlets.is_active,
    })
    .from(outlets)
    .where(inArray(outlets.id, userOutletIds));
};

export const getSettings = async (db: any, outletId: string) => {
  const result = await db.select().from(outlets).where(eq(outlets.id, outletId)).limit(1);
  return result[0] || null;
};

export const updateSettings = async (db: any, outletId: string, data: any) => {
  const result = await db
    .update(outlets)
    .set(data)
    .where(eq(outlets.id, outletId))
    .returning();
  return result[0] || null;
};
