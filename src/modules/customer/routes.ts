import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { customerSchema } from './schema';
import * as customerService from './service';
import { authMiddleware } from '../../middleware/auth';
import { outletMiddleware } from '../../middleware/outlet';
import { requirePermission } from '../../middleware/rbac';
import type { Env, Variables } from '../../lib/types';

const customerRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

customerRouter.use('*', authMiddleware, outletMiddleware);

customerRouter.get('/', async (c) => {
  const data = await customerService.getCustomers(c.get('db'), c.get('outletId'));
  return c.json({ data });
});

customerRouter.post('/', requirePermission('customer:write'), zValidator('json', customerSchema), async (c) => {
  const data = await customerService.createCustomer(c.get('db'), c.get('outletId'), c.req.valid('json'));
  return c.json({ data }, 201);
});

customerRouter.put('/:id', requirePermission('customer:write'), zValidator('json', customerSchema.partial()), async (c) => {
  try {
    const data = await customerService.updateCustomer(c.get('db'), c.get('outletId'), c.req.param('id'), c.req.valid('json'));
    return c.json({ data });
  } catch (err: any) {
    return c.json({ error: err.message }, 404);
  }
});

customerRouter.delete('/:id', requirePermission('customer:write'), async (c) => {
  try {
    await customerService.deleteCustomer(c.get('db'), c.get('outletId'), c.req.param('id'));
    return c.json({ success: true, message: 'Customer deleted' });
  } catch (err: any) {
    return c.json({ error: err.message }, 404);
  }
});

customerRouter.get('/:id/history', async (c) => {
  const data = await customerService.getCustomerHistory(c.get('db'), c.get('outletId'), c.req.param('id'));
  return c.json({ data });
});

export default customerRouter;
