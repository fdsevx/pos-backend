import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import type { Env, Variables } from '../lib/types';
import { createDb } from '../db/client';
import { outlets } from '../db/schema';

export const outletMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } }, 401);
  }

  const outletSlug = c.req.param('outlet');
  if (!outletSlug) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Outlet parameter is required' } }, 400);
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);
  c.set('db', db);

  const [outletRecord] = await db.select().from(outlets).where(eq(outlets.slug, outletSlug)).limit(1);

  if (!outletRecord) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Outlet not found' } }, 404);
  }

  if (user.role !== 'super_admin' && !user.outlet_ids.includes(outletRecord.id)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'No access to this outlet' } }, 403);
  }

  c.set('outletId', outletRecord.id);
  await next();
});
