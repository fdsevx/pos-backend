import { Hono } from 'hono';
import { purchases } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { purchaseSchema } from './schema';
import { createPurchase } from './service';
import { authMiddleware } from '../../middleware/auth';
import { outletMiddleware } from '../../middleware/outlet';
import { requirePermission } from '../../middleware/rbac';
import type { Env, Variables } from '../../lib/types';

const purchaseRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

purchaseRouter.use('*', authMiddleware, outletMiddleware);

purchaseRouter.get('/', async (c) => {
  const outletId = c.get('outletId');
  const db = c.get('db');
  const allPurchases = await db
    .select()
    .from(purchases)
    .where(eq(purchases.outlet_id, outletId))
    .orderBy(desc(purchases.purchased_at));
    
  return c.json({ data: allPurchases });
});

purchaseRouter.post(
  '/', 
  requirePermission('purchase:write'),
  zValidator('json', purchaseSchema), 
  async (c) => {
    const outletId = c.get('outletId');
    const outletSlug = c.req.param('outlet') ?? 'restoran';
    const userId = c.get('user').sub;
    const data = c.req.valid('json');

    try {
      const purchase = await createPurchase(c.get('db'), outletId, userId, outletSlug, data);
      return c.json({ data: purchase }, 201);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
);

export default purchaseRouter;
