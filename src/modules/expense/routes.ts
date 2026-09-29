import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { expenseSchema } from './schema';
import { getExpenses, createExpense } from './service';
import { authMiddleware } from '../../middleware/auth';
import { outletMiddleware } from '../../middleware/outlet';
import { requirePermission } from '../../middleware/rbac';
import type { Env, Variables } from '../../lib/types';

const expenseRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

expenseRouter.use('*', authMiddleware, outletMiddleware);

expenseRouter.get('/', async (c) => {
  const outletId = c.get('outletId');
  const items = await getExpenses(c.get('db'), outletId);
  return c.json({ data: items });
});

expenseRouter.post(
  '/',
  requirePermission('expense:write'),
  zValidator('json', expenseSchema),
  async (c) => {
    const outletId = c.get('outletId');
    const slug = c.req.param('outlet') ?? 'restoran';
    const user = c.get('user');
    const data = c.req.valid('json');

    const expense = await createExpense(c.get('db'), outletId, slug, user.sub, data);
    return c.json({ data: expense }, 201);
  }
);

export default expenseRouter;
