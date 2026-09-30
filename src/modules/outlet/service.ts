import { inArray, eq } from "drizzle-orm";
import { outlets } from "../../db/schema";
export const getOutlets = async (db: any, userOutletIds: string[], isSuperAdmin?: boolean) => {
  if (isSuperAdmin) {
    return await db
      .select({
        id: outlets.id,
        name: outlets.name,
        slug: outlets.slug,
        is_active: outlets.is_active,
      })
      .from(outlets);
  }
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

import { logAudit } from "../../lib/audit";

export const updateSettings = async (db: any, outletId: string, data: any, userId: string) => {
  return await db.transaction(async (tx: any) => {
    const oldSettings = await getSettings(tx, outletId);
    
    const result = await tx
      .update(outlets)
      .set(data)
      .where(eq(outlets.id, outletId))
      .returning();
      
    const newSettings = result[0] || null;
    
    await logAudit(tx, {
      outlet_id: outletId,
      user_id: userId,
      action: "UPDATE_SETTINGS",
      entity_type: "outlet",
      entity_id: outletId,
      before_data: oldSettings,
      after_data: newSettings
    });
    
    return newSettings;
  });
};
