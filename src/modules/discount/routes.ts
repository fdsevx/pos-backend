import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { discountService } from './service';
import { discountSchema } from './schema';
import { authMiddleware } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { outletMiddleware } from '../../middleware/outlet';
import type { Env, Variables } from '../../lib/types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', authMiddleware);
app.use('*', outletMiddleware);

app.get('/', async (c) => {
  const outletId = c.get('outletId');
  const items = await discountService.getDiscounts(c.get('db'), outletId);
  return c.json({ success: true, data: items });
});

app.post('/', requirePermission('discount:write'), zValidator('json', discountSchema), async (c) => {
  const outletId = c.get('outletId');
  const data = c.req.valid('json');
  try {
    const item = await discountService.createDiscount(c.get('db'), outletId, data);
    return c.json({ success: true, data: item }, 201);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.put('/:id', requirePermission('discount:write'), zValidator('json', discountSchema.partial()), async (c) => {
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  const data = c.req.valid('json');
  try {
    const item = await discountService.updateDiscount(c.get('db'), id, outletId, data);
    if (!item) {
      return c.json({ success: false, message: 'Discount not found' }, 404);
    }
    return c.json({ success: true, data: item });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.delete('/:id', requirePermission('discount:write'), async (c) => {
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  const item = await discountService.deleteDiscount(c.get('db'), id, outletId);
  if (!item) {
    return c.json({ success: false, message: 'Discount not found' }, 404);
  }
  return c.json({ success: true, message: 'Discount deleted' });
});

export default app;
