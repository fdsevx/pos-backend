import { eq } from 'drizzle-orm';
import { devices, audit_logs, outlets } from '../../db/schema';
import type { RegisterInput } from './schema';

export async function registerDevice(db: any, data: RegisterInput, userId: string) {
  const existingDevice = await db.query.devices.findFirst({
    where: eq(devices.id, data.device_id),
  });

  if (existingDevice) {
    const [updated] = await db.update(devices)
      .set({
        name: data.name,
        outlet_id: data.outlet_id,
        user_id: userId,
      })
      .where(eq(devices.id, data.device_id))
      .returning();
    return updated;
  }

  const [inserted] = await db.insert(devices).values({
    id: data.device_id,
    name: data.name,
    outlet_id: data.outlet_id,
    user_id: userId,
  }).returning();

  return inserted;
}

export async function switchOutlet(db: any, deviceId: string, newOutletId: string, userId: string) {
  const existingDevice = await db.query.devices.findFirst({
    where: eq(devices.id, deviceId),
  });

  if (!existingDevice) {
    throw new Error('Device not found');
  }

  const oldOutletId = existingDevice.outlet_id;

  const [updated] = await db.update(devices)
    .set({ outlet_id: newOutletId })
    .where(eq(devices.id, deviceId))
    .returning();

  await db.insert(audit_logs).values({
    action: 'SWITCH_OUTLET',
    entity_type: 'device',
    entity_id: null,
    before_data: { old_outlet: oldOutletId },
    after_data: { new_outlet: newOutletId },
    user_id: userId,
  });

  return updated;
}

export async function getDeviceMe(db: any, deviceId: string) {
  const result = await db.select({
    device: devices,
    outlet: outlets,
  })
    .from(devices)
    .leftJoin(outlets, eq(devices.outlet_id, outlets.id))
    .where(eq(devices.id, deviceId));
    
  return result[0];
}
