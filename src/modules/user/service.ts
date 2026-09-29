import { eq, isNull } from 'drizzle-orm';
import { users, user_outlets, user_permissions } from '../../db/schema';
import { hashPassword } from '../../lib/crypto';
import type { UserCreateInput, UserUpdateInput } from './schema';

export async function getUsers(db: any) {
  // Return active users (not deleted)
  return await db
    .select({
      id: users.id,
      username: users.username,
      display_name: users.display_name,
      role: users.role,
      is_active: users.is_active,
      created_at: users.created_at,
    })
    .from(users)
    .where(isNull(users.deleted_at));
}

export async function createUser(db: any, data: UserCreateInput) {
  return await db.transaction(async (tx: any) => {
    // 1. Create user
    const password_hash = await hashPassword(data.password);
    const [user] = await tx
      .insert(users)
      .values({
        username: data.username,
        password_hash,
        display_name: data.display_name,
        role: data.role,
      })
      .returning();

    // 2. Assign outlets
    if (data.outlet_ids && data.outlet_ids.length > 0) {
      const outletValues = data.outlet_ids.map(id => ({ user_id: user.id, outlet_id: id }));
      await tx.insert(user_outlets).values(outletValues);
    }

    // 3. Assign permissions
    if (data.permissions && data.permissions.length > 0) {
      const permValues = data.permissions.map(p => ({ user_id: user.id, permission: p }));
      await tx.insert(user_permissions).values(permValues);
    }

    return { id: user.id, username: user.username, display_name: user.display_name, role: user.role };
  });
}

export async function updateUser(db: any, id: string, data: UserUpdateInput) {
  return await db.transaction(async (tx: any) => {
    const updateData: any = { updated_at: new Date() };
    if (data.display_name !== undefined) updateData.display_name = data.display_name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    if (Object.keys(updateData).length > 1) {
      await tx.update(users).set(updateData).where(eq(users.id, id));
    }

    // Update outlets (replace all)
    if (data.outlet_ids) {
      await tx.delete(user_outlets).where(eq(user_outlets.user_id, id));
      if (data.outlet_ids.length > 0) {
        const outletValues = data.outlet_ids.map(oid => ({ user_id: id, outlet_id: oid }));
        await tx.insert(user_outlets).values(outletValues);
      }
    }

    // Update permissions (replace all)
    if (data.permissions) {
      await tx.delete(user_permissions).where(eq(user_permissions.user_id, id));
      if (data.permissions.length > 0) {
        const permValues = data.permissions.map(p => ({ user_id: id, permission: p }));
        await tx.insert(user_permissions).values(permValues);
      }
    }

    return { success: true };
  });
}

export async function resetUserPassword(db: any, id: string, newPassword: string) {
  const password_hash = await hashPassword(newPassword);
  const [updated] = await db
    .update(users)
    .set({ password_hash, updated_at: new Date() })
    .where(eq(users.id, id))
    .returning();
    
  if (!updated) throw new Error("User not found");
  return { success: true };
}

export async function deleteUser(db: any, id: string) {
  const [deleted] = await db
    .update(users)
    .set({ deleted_at: new Date(), is_active: false })
    .where(eq(users.id, id))
    .returning();
    
  if (!deleted) throw new Error("User not found");
  return { success: true };
}
